import io
import logging

import uvicorn.logging
from docx import Document as Docx

from app import logging_utils
from app.export.docx import export_docx
from app.schemas import DocItem, DocSection, Document

KEY = "sk-ant-api03-SECRETSECRETSECRET1234567890"


def test_uvicorn_access_record_formats_and_is_redacted():
    logging_utils.install_redaction()
    rec = logging.getLogger("uvicorn.access").makeRecord(
        "uvicorn.access", logging.INFO, __file__, 1,
        '%s - "%s %s HTTP/%s" %d', ("127.0.0.1:5555", "POST", f"/api/x?key={KEY}", "1.1", 200), None,
    )
    assert rec.args == ("127.0.0.1:5555", "POST", "/api/x?key=[REDACTED]", "1.1", 200)  # shape and types kept
    out = uvicorn.logging.AccessFormatter('%(client_addr)s - "%(request_line)s" %(status_code)s', use_colors=False).format(rec)
    assert out == '127.0.0.1:5555 - "POST /api/x?key=[REDACTED] HTTP/1.1" 200 OK'
    assert KEY not in out and "SECRETSECRET" not in rec.getMessage()


def test_mapping_args_keep_their_shape():
    logging_utils.install_redaction()
    rec = logging.getLogger("t").makeRecord("t", logging.INFO, __file__, 1, "%(k)s %(n)d", {"k": KEY, "n": 3}, None)
    assert rec.args == {"k": "[REDACTED]", "n": 3} and rec.getMessage() == "[REDACTED] 3"


def test_docx_survives_xml_invalid_control_characters():
    bad = "a\u000bb\u0000c\u0008d\u001fe\u000cf"
    doc = Document(name=f"Ada{bad}", contact=[f"x{bad}"], sections=[DocSection(
        title=f"Exp{bad}", paragraphs=[f"p{bad}"],
        items=[DocItem(heading=f"H{bad}", subheading=f"S{bad}", dates=f"D{bad}", note=f"N{bad}", bullets=[f"b{bad}"])])])
    for t in ("classic", "modern", "compact"):
        out = Docx(io.BytesIO(export_docx(doc, t).getvalue()))
        text = "\n".join(p.text for p in out.paragraphs)
        assert "abcdef" in text and "\u000b" not in text


def test_docx_route_no_longer_500s_on_control_chars(client):
    r = client.post("/api/export/docx", json={"doc": {"name": "Ada\u000b", "sections": [
        {"title": "T", "paragraphs": ["x\u0000y"], "items": []}]}})
    assert r.status_code == 200
