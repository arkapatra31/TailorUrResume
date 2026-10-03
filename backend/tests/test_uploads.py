import asyncio
import os
import tempfile

import pytest

from app import config
from app.uploads import UploadError, UploadLimitMiddleware, parse_multipart_file
from tests.test_api import H, make_docx


def spy_tempfiles(monkeypatch):
    calls = []
    for name in ("TemporaryFile", "NamedTemporaryFile", "SpooledTemporaryFile", "mkstemp", "mkdtemp", "TemporaryDirectory"):
        orig = getattr(tempfile, name)

        def spy(*a, _n=name, _o=orig, **k):
            calls.append(_n)
            return _o(*a, **k)

        monkeypatch.setattr(tempfile, name, spy)
    return calls


def test_large_upload_never_creates_a_temp_file(client, monkeypatch):
    calls = spy_tempfiles(monkeypatch)
    data = make_docx() + os.urandom(1_500_000)  # > Starlette's 1 MB spool threshold
    r = client.post("/api/profile/parse", headers=H, files={"file": ("cv.docx", data)})
    assert r.status_code in (200, 422)
    assert calls == []


def test_small_upload_still_works_and_uses_no_temp_file(client, monkeypatch):
    calls = spy_tempfiles(monkeypatch)
    r = client.post("/api/profile/parse", headers=H, files={"file": ("cv.docx", make_docx())})
    assert r.status_code == 200 and calls == []


def test_oversize_content_length_gets_413(client, monkeypatch):
    monkeypatch.setattr(config, "MAX_REQUEST_BYTES", 100_000)
    r = client.post("/api/profile/parse", headers=H, files={"file": ("cv.pdf", os.urandom(200_000))})
    assert r.status_code == 413 and "too large" in r.json()["detail"]


def test_file_over_file_limit_but_under_request_limit_gets_413(client, monkeypatch):
    monkeypatch.setattr(config, "MAX_UPLOAD_BYTES", 50_000)
    r = client.post("/api/profile/parse", headers=H, files={"file": ("cv.pdf", os.urandom(80_000))})
    assert r.status_code == 413


def test_non_multipart_and_missing_field_are_422(client):
    assert client.post("/api/profile/parse", headers=H, content=b"x").status_code == 422
    r = client.post("/api/profile/parse", headers=H, files={"other": ("cv.docx", make_docx())})
    assert r.status_code == 422


def run_asgi(app, headers, chunks):
    sent, calls = [], []
    queue = [{"type": "http.request", "body": c, "more_body": i < len(chunks) - 1} for i, c in enumerate(chunks)]

    async def inner(scope, receive, send):
        calls.append((await receive())["body"])
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    async def receive():
        return queue.pop(0) if queue else {"type": "http.disconnect"}

    async def send(m):
        sent.append(m)

    scope = {"type": "http", "method": "POST", "path": "/api/profile/parse", "headers": headers}
    asyncio.run(UploadLimitMiddleware(inner, max_bytes=1000)(scope, receive, send))
    return sent, calls, len(queue)


def test_streaming_cap_without_content_length_stops_reading():
    sent, calls, left = run_asgi(None, [], [b"x" * 400] * 10)
    assert sent[0]["status"] == 413 and calls == []
    assert left > 5  # did not drain the whole stream


def test_lying_content_length_is_caught_by_the_stream_cap():
    sent, calls, _ = run_asgi(None, [(b"content-length", b"10")], [b"x" * 600, b"x" * 600])
    assert sent[0]["status"] == 413 and calls == []


def test_under_cap_body_is_replayed_whole():
    sent, calls, _ = run_asgi(None, [], [b"a" * 300, b"b" * 300])
    assert sent[0]["status"] == 200 and calls == [b"a" * 300 + b"b" * 300]


def test_multipart_binary_roundtrip_with_crlf_and_boundary_lookalikes():
    payload = b"\r\n--looks-like-boundary\r\n" + os.urandom(5000) + b"\r\n\r\n"
    boundary = "XBOUNDARYX"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"note\"\r\n\r\nhi\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"résumé.pdf\"\r\n"
            "Content-Type: application/pdf\r\n\r\n").encode() + payload + f"\r\n--{boundary}--\r\n".encode()
    name, data = parse_multipart_file(f"multipart/form-data; boundary={boundary}", body)
    assert name.endswith(".pdf") and data == payload


def test_multipart_errors():
    with pytest.raises(UploadError):
        parse_multipart_file("application/json", b"{}")
    with pytest.raises(UploadError):
        parse_multipart_file("multipart/form-data; boundary=b", b"garbage")
