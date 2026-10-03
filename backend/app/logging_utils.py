"""Log redaction: API keys must never reach logs."""
from __future__ import annotations

import contextvars
import logging
import re
import traceback

current_key: contextvars.ContextVar[str] = contextvars.ContextVar("current_key", default="")

_PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9_\-]{8,}"),
    re.compile(r"(?i)(x-llm-key['\"]?\s*[:=]\s*['\"]?)(?!%)[^\s'\",}]+"),
    re.compile(r"(?i)(bearer\s+)[A-Za-z0-9_\-\.]{8,}"),
]
MASK = "[REDACTED]"


def redact(text: str) -> str:
    if not text:
        return text
    key = current_key.get()
    if key and len(key) >= 4:
        text = text.replace(key, MASK)
    text = _PATTERNS[0].sub(MASK, text)
    text = _PATTERNS[1].sub(lambda m: m.group(1) + MASK, text)
    text = _PATTERNS[2].sub(lambda m: m.group(1) + MASK, text)
    return text


def _redact_args(args):
    if isinstance(args, tuple):
        return tuple(redact(a) if isinstance(a, str) else a for a in args)
    if isinstance(args, dict):
        return {k: (redact(v) if isinstance(v, str) else v) for k, v in args.items()}
    return args


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            # Keep msg and args separate so %-formatting (e.g. uvicorn's '%d' status) still works:
            # redact only the string values and preserve the shape (tuple or mapping).
            if isinstance(record.msg, str):
                record.msg = redact(record.msg)
            record.args = _redact_args(record.args)
            if record.exc_info:
                record.exc_text = redact("".join(traceback.format_exception(*record.exc_info)))
                record.exc_info = None
        except Exception:  # never let logging break a request
            pass
        return True


_installed = False


def install_redaction() -> None:
    """Redact every record at creation time, regardless of handler."""
    global _installed
    if _installed:
        return
    _installed = True
    old_factory = logging.getLogRecordFactory()
    flt = RedactingFilter()

    def factory(*args, **kwargs):
        record = old_factory(*args, **kwargs)
        flt.filter(record)
        return record

    logging.setLogRecordFactory(factory)
