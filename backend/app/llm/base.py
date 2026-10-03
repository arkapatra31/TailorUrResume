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


_FENCE_RE = re.compile(r"```(?:json|JSON)?[ \t]*\r?\n?(.*?)(?:```|\Z)", re.S)
_TRAILING_COMMA_RE = re.compile(r",(\s*[}\]])")


def extract_json(text: str) -> str:
    """Best-effort slice of the JSON payload out of a model reply (kept for callers/tests)."""
    text = text.strip()
    fence = _FENCE_RE.search(text)
    if fence:
        text = fence.group(1).strip()
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=-1)
    if start < 0:
        return text
    end = max(text.rfind("}"), text.rfind("]"))
    return text[start : end + 1] if end > start else text[start:]


_STRING_RE = re.compile(r'"(?:\\.|[^"\\])*"')


def _strip_trailing_commas(text: str) -> str:
    """Remove commas that directly precede a closing bracket, ignoring anything inside strings."""
    masked = _STRING_RE.sub(lambda m: '"' + "\x00" * (len(m.group(0)) - 2) + '"', text)
    drop = {m.start() for m in re.finditer(r",(?=\s*[}\]])", masked)}
    return "".join(c for i, c in enumerate(text) if i not in drop) if drop else text


def parse_model_json(raw: str, schema: Type[T]) -> T:
    """Tolerantly parse a model reply into `schema`.

    Strips code fences, then scans from every "{" with JSONDecoder.raw_decode (so prose before or
    after the object, or several objects, are fine). Each text is tried as-is and once more with
    trailing commas removed. Of the objects that validate, the one that sets the most schema fields
    wins (so a stray "{}" in the prose never beats the real answer).
    """
    decoder = json.JSONDecoder()
    texts = [m.group(1) for m in _FENCE_RE.finditer(raw)] + [raw]
    best: Optional[T] = None
    last: Exception = ValueError("no JSON object found")
    for text in texts:
        for variant in dict.fromkeys((text, _strip_trailing_commas(text))):
            skip_until = 0
            for m in re.finditer(r"\{", variant):
                if m.start() < skip_until:
                    continue  # nested inside an object we already decoded
                try:
                    obj, end = decoder.raw_decode(variant, m.start())
                except ValueError as e:
                    last = e
                    continue
                skip_until = end
                try:
                    cand = schema.model_validate(obj)
                except ValidationError as e:
                    last = e
                    continue
                if best is None or len(cand.model_fields_set) > len(best.model_fields_set):
                    best = cand
            if best is not None:
                return best
    raise ValueError(str(last))


class LLMProvider(ABC):
    name = "base"
    #: True when the last stream()/complete() stopped because the output token limit was hit.
    truncated = False

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
            return parse_model_json(raw, schema)
        except ValueError as first_err:
            if not retry:
                raise LLMError("The model returned invalid JSON.") from first_err
            repair = (
                f"{prompt}\n\nYour previous reply was invalid:\n{raw[:4000]}\n\n"
                f"Error: {str(first_err)[:800]}\nReturn ONLY corrected JSON."
            )
            raw2 = await self.complete(sys_full, repair, json_mode=True)
            try:
                return parse_model_json(raw2, schema)
            except ValueError as err:
                raise LLMError("The model returned invalid JSON after a repair attempt.") from err
