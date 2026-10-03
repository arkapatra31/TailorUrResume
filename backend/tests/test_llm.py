import json

import httpx
import pytest
from pydantic import BaseModel

from app.llm.base import LLMError, LLMProvider, ProviderConfig
from app.llm.factory import config_from_headers
from app.llm.ollama import OllamaProvider


class S(BaseModel):
    a: int


class Scripted(LLMProvider):
    def __init__(self, replies):
        self.replies = list(replies)

    async def complete(self, system, prompt, json_mode=False):
        return self.replies.pop(0)

    async def stream(self, system, prompt):
        yield ""


async def test_repair_retry_succeeds():
    p = Scripted(["not json", '```json\n{"a": 3}\n```'])
    assert (await p.complete_json("s", "p", S)).a == 3


async def test_repair_gives_up():
    with pytest.raises(LLMError):
        await Scripted(["x", "y"]).complete_json("s", "p", S)


def test_header_config_and_repr_hides_key():
    cfg = config_from_headers({"x-llm-key": "sk-ant-abc123456789", "x-llm-provider": "anthropic"})
    assert cfg.model == "claude-sonnet-5-5" and "sk-ant" not in repr(cfg)
    assert config_from_headers({"x-llm-provider": "ollama"}).base_url.startswith("http")


async def test_ollama_json_and_stream():
    seen = {}

    def h(req):
        body = json.loads(req.content)
        seen.update(body)
        if body["stream"]:
            lines = [json.dumps({"message": {"content": c}, "done": False}) for c in ("He", "llo")]
            lines.append(json.dumps({"done": True}))
            return httpx.Response(200, text="\n".join(lines))
        return httpx.Response(200, json={"message": {"content": '{"a": 1}'}})

    p = OllamaProvider(ProviderConfig("ollama", "", "m", "http://x:11434"), transport=httpx.MockTransport(h))
    assert (await p.complete_json("s", "p", S)).a == 1 and seen["format"] == "json"
    assert "".join([c async for c in p.stream("s", "p")]) == "Hello"
