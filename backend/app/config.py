"""Environment-driven configuration. No secrets live here."""
import os

DEFAULT_ANTHROPIC_MODEL = os.getenv("DEFAULT_ANTHROPIC_MODEL", "claude-sonnet-5-5")
DEFAULT_OLLAMA_MODEL = os.getenv("DEFAULT_OLLAMA_MODEL", "llama3.1")
DEFAULT_OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
    ).split(",")
    if o.strip()
]
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))
MAX_TEXT_CHARS = int(os.getenv("MAX_TEXT_CHARS", "40000"))
FETCH_TIMEOUT = float(os.getenv("FETCH_TIMEOUT", "12"))
FETCH_MAX_BYTES = int(os.getenv("FETCH_MAX_BYTES", str(2 * 1024 * 1024)))
FETCH_USE_ENV_PROXY = os.getenv("FETCH_USE_ENV_PROXY", "").lower() in ("1", "true", "yes")
