from __future__ import annotations

from urllib.parse import urlsplit

from .. import config
from .anthropic import AnthropicProvider
from .base import LLMError, LLMProvider, ProviderConfig
from .ollama import OllamaProvider


def _norm_url(u: str) -> str:
    return u.strip().rstrip("/").lower()


def validate_ollama_base_url(base: str) -> str:
    """Accept only the server's configured OLLAMA_URL or a host on ALLOWED_OLLAMA_HOSTS (SSRF guard)."""
    base = base.strip()
    if not base:
        return config.DEFAULT_OLLAMA_URL
    if _norm_url(base) == _norm_url(config.DEFAULT_OLLAMA_URL):
        return config.DEFAULT_OLLAMA_URL
    denied = LLMError("That Ollama URL is not allowed by this server (see ALLOWED_OLLAMA_HOSTS).", 400)
    try:
        u = urlsplit(base)
        host = (u.hostname or "").lower()
        u.port  # raises ValueError on a malformed port
    except ValueError:
        raise denied from None
    if u.scheme not in ("http", "https") or u.username or u.password or u.query or u.fragment:
        raise denied
    if u.path not in ("", "/") or host not in config.allowed_ollama_hosts():
        raise denied
    netloc = f"[{host}]" if ":" in host else host
    return f"{u.scheme}://{netloc}" + (f":{u.port}" if u.port else "")


def config_from_headers(headers) -> ProviderConfig:
    provider = (headers.get("x-llm-provider") or "anthropic").lower()
    key = headers.get("x-llm-key") or ""
    model = headers.get("x-llm-model") or ""
    base = headers.get("x-llm-base-url") or ""
    if provider == "ollama":
        return ProviderConfig("ollama", "", model or config.DEFAULT_OLLAMA_MODEL, validate_ollama_base_url(base))
    if provider == "anthropic":
        return ProviderConfig("anthropic", key, model or config.DEFAULT_ANTHROPIC_MODEL)
    raise LLMError(f"Unknown provider '{provider}'.", 400)


def build_provider(cfg: ProviderConfig) -> LLMProvider:
    if cfg.provider == "ollama":
        return OllamaProvider(cfg)
    return AnthropicProvider(cfg)
