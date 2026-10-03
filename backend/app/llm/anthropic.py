"""Anthropic provider. The client is built per request from the caller's key."""
from __future__ import annotations

from typing import AsyncIterator

import anthropic

from .base import LLMError, LLMProvider, ProviderConfig

MAX_TOKENS = 8192


def _wrap(err: Exception) -> LLMError:
    if isinstance(err, anthropic.AuthenticationError):
        return LLMError("Anthropic rejected the API key.", 401)
    if isinstance(err, anthropic.PermissionDeniedError):
        return LLMError("Anthropic denied access for this key.", 403)
    if isinstance(err, anthropic.RateLimitError):
        return LLMError("Anthropic rate limit reached. Try again shortly.", 429)
    if isinstance(err, anthropic.NotFoundError):
        return LLMError("Model not found. Check the model name in Settings.", 404)
    if isinstance(err, anthropic.APIConnectionError):
        return LLMError("Could not reach Anthropic.", 502)
    if isinstance(err, anthropic.APIStatusError):
        return LLMError(f"Anthropic returned an error (HTTP {err.status_code}).", 502)
    return LLMError("Unexpected provider error.", 502)


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, cfg: ProviderConfig):
        if not cfg.api_key:
            raise LLMError("Missing API key (X-LLM-Key header).", 401)
        self.model = cfg.model
        # Built per request; never stored beyond this object's lifetime.
        self._client = anthropic.AsyncAnthropic(api_key=cfg.api_key, max_retries=1)

    async def complete(self, system: str, prompt: str, json_mode: bool = False) -> str:
        try:
            msg = await self._client.messages.create(
                model=self.model,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as e:  # noqa: BLE001
            raise _wrap(e) from None
        return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")

    async def stream(self, system: str, prompt: str) -> AsyncIterator[str]:
        try:
            async with self._client.messages.stream(
                model=self.model,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=[{"role": "user", "content": prompt}],
            ) as s:
                async for text in s.text_stream:
                    yield text
        except Exception as e:  # noqa: BLE001
            raise _wrap(e) from None
