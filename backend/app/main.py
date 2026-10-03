"""TailorUrResume API. Stateless: no DB, no disk writes, no server-side sessions or caches."""
from __future__ import annotations

import json
import logging
import re
from typing import AsyncIterator

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from . import config
from .export.docx import export_docx
from .export.pdf import PdfUnavailable, export_pdf
from .jd.extract import extract_jd
from .jd.fetchers import FetchError, fetch_job
from .llm import factory
from .llm.base import LLMError, LLMProvider
from .logging_utils import current_key, install_redaction, redact
from .profile.parse import ParseError, extract_text, parse_profile
from .schemas import (
    ExportRequest, ExtractRequest, FetchRequest, GenerateRequest, JobDescription, MatchRequest,
    MatchResult, Profile, RegenerateBulletRequest, TruthRequest,
)
from .tailor.generate import generate_events, regenerate_bullet
from .tailor.match import analyze_match
from .tailor.truth import check_document
from .uploads import UploadError, UploadLimitMiddleware, parse_multipart_file

install_redaction()
log = logging.getLogger("tailorurresume")

app = FastAPI(title="TailorUrResume", version="1.0.0")
app.add_middleware(UploadLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def key_scope(request: Request, call_next):
    """Expose the per-request key to the log redactor only; it is never stored."""
    token = current_key.set(request.headers.get("x-llm-key", ""))
    try:
        resp = await call_next(request)
    finally:
        current_key.reset(token)
    resp.headers["Cache-Control"] = "no-store"
    return resp


def get_provider(request: Request) -> LLMProvider:
    cfg = factory.config_from_headers(request.headers)
    return factory.build_provider(cfg)


@app.exception_handler(LLMError)
async def llm_error_handler(_: Request, exc: LLMError):
    return JSONResponse({"detail": redact(str(exc))}, status_code=exc.status)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.error("Unhandled error: %s", type(exc).__name__)
    return JSONResponse({"detail": "Internal server error."}, status_code=500)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/test-connection")
async def test_connection(provider: LLMProvider = Depends(get_provider)):
    await provider.ping()
    return {"ok": True, "provider": provider.name, "model": provider.model}


@app.post("/api/profile/parse", response_model=Profile)
async def profile_parse(request: Request, provider: LLMProvider = Depends(get_provider)):
    # Parsed in memory (see uploads.py): Starlette's form parser would spool big files to disk.
    try:
        filename, data = parse_multipart_file(request.headers.get("content-type", ""), await request.body())
        if len(data) > config.MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"File too large (limit {config.MAX_UPLOAD_BYTES // (1024 * 1024)} MB).")
        text = extract_text(filename, data)
    except (UploadError, ParseError) as e:
        raise HTTPException(422, str(e)) from None
    return await parse_profile(provider, text)


@app.post("/api/jd/fetch")
async def jd_fetch(req: FetchRequest):
    try:
        job = await fetch_job(req.url)
    except FetchError as e:
        raise HTTPException(422, str(e)) from None
    return job.dict()


@app.post("/api/jd/extract", response_model=JobDescription)
async def jd_extract(req: ExtractRequest, provider: LLMProvider = Depends(get_provider)):
    if len(req.text.strip()) < 20:
        raise HTTPException(422, "Job description text is too short.")
    return await extract_jd(provider, req.text, req.source_url)


@app.post("/api/match", response_model=MatchResult)
async def match(req: MatchRequest, provider: LLMProvider = Depends(get_provider)):
    return await analyze_match(provider, req.profile, req.jd)


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.post("/api/generate")
async def generate(req: GenerateRequest, provider: LLMProvider = Depends(get_provider)):
    async def gen() -> AsyncIterator[str]:
        try:
            async for ev in generate_events(provider, req):
                yield _sse(ev["event"], ev["data"])
        except LLMError as e:
            yield _sse("error", {"detail": redact(str(e))})
        except Exception as e:  # noqa: BLE001
            log.error("Generation failed: %s", type(e).__name__)
            yield _sse("error", {"detail": "Generation failed."})

    return StreamingResponse(
        gen(), media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@app.post("/api/regenerate-bullet")
async def regen_bullet(req: RegenerateBulletRequest, provider: LLMProvider = Depends(get_provider)):
    bullet, unsupported = await regenerate_bullet(provider, req)
    return {"bullet": bullet, "unsupported": unsupported}


@app.post("/api/check-truth")
async def check_truth(req: TruthRequest):
    return {"flags": [f.model_dump() for f in check_document(req.profile, req.doc, req.jd)]}


def _filename(req: ExportRequest, ext: str) -> str:
    base = re.sub(r"[^A-Za-z0-9]+", "_", req.doc.name or "document").strip("_") or "document"
    kind = {"resume": "Resume", "cv": "CV", "cover_letter": "Cover_Letter"}[req.doc.kind]
    return f"{base}_{kind}.{ext}"


@app.post("/api/export/pdf")
async def export_pdf_route(req: ExportRequest):
    try:
        buf = export_pdf(req.doc, req.template)
    except PdfUnavailable as e:
        raise HTTPException(503, str(e)) from None
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{_filename(req, "pdf")}"'},
    )


@app.post("/api/export/docx")
async def export_docx_route(req: ExportRequest):
    buf = export_docx(req.doc, req.template)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{_filename(req, "docx")}"'},
    )
