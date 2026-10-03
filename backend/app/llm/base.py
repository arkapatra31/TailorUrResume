"""Provider abstraction: stream() and complete_json(schema) with one repair retry."""
from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator, Optional, Type, TypeVar

from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)


class LLMError(Exception):
    """Provider failure. Messages must be safe to show to the user."""

    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


@dataclass
class ProviderConfig:
    provider: str = "anthropic"
    api_key: str = ""
    model: str = ""
    base_url: str = ""

    def __repr__(self) -> str:  # never leak the key through repr
        return f"ProviderConfig(provider={self.provider!r}, model={self.model!r})"


def extract_json(text: str) -> str:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fence:
        text = fence.group(1).strip()
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=-1)
    if start < 0:
        return text
    end = max(text.rfind("}"), text.rfind("]"))
    return text[start : end + 1] if end > start else text[start:]


class LLMProvider(ABC):
    name = "base"

    @abstractmethod
    async def complete(self, system: str, prompt: str, json_mode: bool = False) -> str:
        """Single non-streaming completion returning raw text."""

    @abstractmethod
    def stream(self, system: str, prompt: str) -> AsyncIterator[str]:
        """Yield text chunks."""

    async def ping(self) -> None:
        await self.complete("Reply with the single word: ok", "ping")

    async def complete_json(
        self, system: str, prompt: str, schema: Type[T], *, retry: bool = True
    ) -> T:
        schema_json = json.dumps(schema.model_json_schema())
        sys_full = (
            f"{system}\n\nRespond with ONLY a single valid JSON object (no prose, no code "
            f"fences) that conforms to this JSON Schema:\n{schema_json}"
        )
        raw = await self.complete(sys_full, prompt, json_mode=True)
        try:
            return schema.model_validate_json(extract_json(raw))
        except (ValidationError, ValueError) as first_err:
            if not retry:
                raise LLMError("The model returned invalid JSON.") from first_err
            repair = (
                f"{prompt}\n\nYour previous reply was invalid:\n{raw[:4000]}\n\n"
                f"Error: {str(first_err)[:800]}\nReturn ONLY corrected JSON."
            )
            raw2 = await self.complete(sys_full, repair, json_mode=True)
            try:
                return schema.model_validate_json(extract_json(raw2))
            except (ValidationError, ValueError) as err:
                raise LLMError("The model returned invalid JSON after a repair attempt.") from err
