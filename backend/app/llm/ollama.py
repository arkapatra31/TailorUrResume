"""Ollama provider over httpx (/api/chat)."""
from __future__ import annotations

import json
from typing import AsyncIterator

import httpx

from .base import LLMError, LLMProvider, ProviderConfig


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(self, cfg: ProviderConfig, transport: httpx.AsyncBaseTransport | None = None):
        self.model = cfg.model
        self.base = cfg.base_url.rstrip("/")
        self._transport = transport

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=httpx.Timeout(300, connect=10), transport=self._transport)

    def _payload(self, system: str, prompt: str, stream: bool, json_mode: bool) -> dict:
        p = {
            "model": self.model,
            "stream": stream,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        }
        if json_mode:
            p["format"] = "json"
        return p

    async def complete(self, system: str, prompt: str, json_mode: bool = False) -> str:
        try:
            async with self._client() as c:
                r = await c.post(f"{self.base}/api/chat", json=self._payload(system, prompt, False, json_mode))
                r.raise_for_status()
                return r.json().get("message", {}).get("content", "")
        except httpx.HTTPStatusError as e:
            raise LLMError(f"Ollama returned HTTP {e.response.status_code}.") from None
        except (httpx.HTTPError, ValueError):
            raise LLMError("Could not reach Ollama. Is it running and is the URL correct?") from None

    async def stream(self, system: str, prompt: str) -> AsyncIterator[str]:
        try:
            async with self._client() as c:
                async with c.stream(
                    "POST", f"{self.base}/api/chat", json=self._payload(system, prompt, True, False)
                ) as r:
                    r.raise_for_status()
                    async for line in r.aiter_lines():
                        if not line.strip():
                            continue
                        data = json.loads(line)
                        chunk = data.get("message", {}).get("content", "")
                        if chunk:
                            yield chunk
                        if data.get("done"):
                            break
        except httpx.HTTPStatusError as e:
            raise LLMError(f"Ollama returned HTTP {e.response.status_code}.") from None
        except (httpx.HTTPError, ValueError):
            raise LLMError("Could not reach Ollama. Is it running and is the URL correct?") from None
