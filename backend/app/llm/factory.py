from __future__ import annotations

from .. import config
from .anthropic import AnthropicProvider
from .base import LLMError, LLMProvider, ProviderConfig
from .ollama import OllamaProvider


def config_from_headers(headers) -> ProviderConfig:
    provider = (headers.get("x-llm-provider") or "anthropic").lower()
    key = headers.get("x-llm-key") or ""
    model = headers.get("x-llm-model") or ""
    base = headers.get("x-llm-base-url") or ""
    if provider == "ollama":
        return ProviderConfig("ollama", "", model or config.DEFAULT_OLLAMA_MODEL, base or config.DEFAULT_OLLAMA_URL)
    if provider == "anthropic":
        return ProviderConfig("anthropic", key, model or config.DEFAULT_ANTHROPIC_MODEL)
    raise LLMError(f"Unknown provider '{provider}'.", 400)


def build_provider(cfg: ProviderConfig) -> LLMProvider:
    if cfg.provider == "ollama":
        return OllamaProvider(cfg)
    return AnthropicProvider(cfg)
