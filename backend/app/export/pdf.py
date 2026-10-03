from __future__ import annotations

import io
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from ..schemas import Document
from .styles import TEMPLATES

_env = Environment(
    loader=FileSystemLoader(str(Path(__file__).parent / "templates")),
    autoescape=select_autoescape(["html"]),
)


class PdfUnavailable(Exception):
    pass


def render_html(doc: Document, template: str) -> str:
    return _env.get_template("document.html").render(doc=doc, t=TEMPLATES[template])


def export_pdf(doc: Document, template: str) -> io.BytesIO:
    try:
        from weasyprint import HTML  # lazy: needs system libs (pango/cairo)
    except (ImportError, OSError) as e:
        raise PdfUnavailable(
            "PDF export is unavailable: WeasyPrint system libraries (pango) are missing on the server. "
            "Use DOCX export, or install the libraries (see README)."
        ) from e
    buf = io.BytesIO()
    HTML(string=render_html(doc, template)).write_pdf(buf)
    buf.seek(0)
    return buf
