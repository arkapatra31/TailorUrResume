"""In-memory upload handling: size limits and multipart parsing that never touches the disk.

Starlette's request.form() spools parts larger than 1 MB into a temporary file. This app is
stateless ("no disk writes"), so uploads are buffered in RAM under a hard cap by an ASGI
middleware and parsed here with the standard library instead.
"""
from __future__ import annotations

import json
from email.parser import BytesParser
from email.policy import HTTP

from . import config

UPLOAD_PATHS = {"/api/profile/parse"}


class UploadError(ValueError):
    pass


async def _send_413(send, limit: int) -> None:
    body = json.dumps({"detail": f"Upload too large (limit {limit // (1024 * 1024)} MB)."}).encode()
    await send({"type": "http.response.start", "status": 413,
                "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()),
                            (b"connection", b"close"), (b"cache-control", b"no-store")]})
    await send({"type": "http.response.body", "body": body})


class UploadLimitMiddleware:
    """Reject oversize uploads from Content-Length, and while streaming when it is absent or lies.

    The (already capped) body is buffered in memory and replayed to the app as a single message.
    """

    def __init__(self, app, paths: set[str] | None = None, max_bytes: int | None = None):
        self.app = app
        self.paths = paths if paths is not None else UPLOAD_PATHS
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST" or scope["path"] not in self.paths:
            return await self.app(scope, receive, send)
        limit = self.max_bytes or config.MAX_REQUEST_BYTES
        for k, v in scope["headers"]:
            if k == b"content-length":
                try:
                    declared = int(v)
                except ValueError:
                    declared = -1
                if declared < 0 or declared > limit:
                    return await _send_413(send, limit)
        chunks: list[bytes] = []
        total = 0
        while True:
            msg = await receive()
            if msg["type"] == "http.disconnect":
                return
            total += len(msg.get("body", b""))
            if total > limit:
                return await _send_413(send, limit)
            chunks.append(msg.get("body", b""))
            if not msg.get("more_body", False):
                break
        body = b"".join(chunks)
        sent = False

        async def replay():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()  # disconnect

        await self.app(scope, replay, send)


def parse_multipart_file(content_type: str, body: bytes, field: str = "file") -> tuple[str, bytes]:
    """Return (filename, data) of the named file part, parsing entirely in memory."""
    if not content_type.lower().startswith("multipart/form-data") or "boundary=" not in content_type.lower():
        raise UploadError("Expected a multipart/form-data upload.")
    try:
        msg = BytesParser(policy=HTTP).parsebytes(
            b"MIME-Version: 1.0\r\nContent-Type: " + content_type.encode("latin-1", "replace") + b"\r\n\r\n" + body
        )
        parts = list(msg.iter_parts()) if msg.is_multipart() else []
    except Exception:  # noqa: BLE001 - malformed multipart
        raise UploadError("Malformed upload.") from None
    for part in parts:
        if part.get_content_disposition() != "form-data" or part.get_param("name", header="content-disposition") != field:
            continue
        filename = part.get_filename() or ""
        data = part.get_payload(decode=True)
        if data is None:
            data = b""
        return filename, bytes(data)
    raise UploadError(f"Missing '{field}' file field.")
