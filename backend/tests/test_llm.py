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


# ---------------------------------------------------------------- Ollama SSRF guard
from app import config
from app.llm import factory
from app.llm.ollama import GENERIC_ERROR


@pytest.fixture
def ollama_env(monkeypatch):
    monkeypatch.delenv("ALLOWED_OLLAMA_HOSTS", raising=False)
    monkeypatch.setattr(config, "DEFAULT_OLLAMA_URL", "http://ollama-prod.internal:11434")


def ollama_cfg(base):
    return config_from_headers({"x-llm-provider": "ollama", "x-llm-base-url": base})


@pytest.mark.parametrize("base", [
    "http://localhost:11434", "http://127.0.0.1:11434/", "http://ollama:11434", "http://host.docker.internal:11434",
    "https://LOCALHOST:8443", "http://ollama-prod.internal:11434", "http://ollama-prod.internal:11434/",
])
def test_allowed_ollama_urls(ollama_env, base):
    assert ollama_cfg(base).base_url.startswith("http")


def test_empty_base_url_uses_server_default(ollama_env):
    assert config_from_headers({"x-llm-provider": "ollama"}).base_url == "http://ollama-prod.internal:11434"


@pytest.mark.parametrize("base", [
    "http://169.254.169.254/latest/meta-data", "http://10.0.0.5:11434", "http://evil.example.com", "http://[::1]:11434.evil.com",
    "http://localhost.evil.com", "http://user:pw@localhost:11434", "http://localhost:11434@evil.com",
    "http://evil.com#@localhost", "http://localhost/path", "http://localhost?x=1", "file:///etc/passwd", "ftp://localhost",
    "http://localhost:99999", "http://0x7f.0.0.1", "http://2130706433", "localhost:11434", "http://ollama-prod.internal:9999",
])
def test_disallowed_ollama_urls_rejected(ollama_env, base):
    with pytest.raises(LLMError) as e:
        ollama_cfg(base)
    assert e.value.status == 400


def test_allowlist_env_is_configurable(ollama_env, monkeypatch):
    monkeypatch.setenv("ALLOWED_OLLAMA_HOSTS", "gpu-box.lan, localhost")
    assert ollama_cfg("http://gpu-box.lan:11434").base_url == "http://gpu-box.lan:11434"
    with pytest.raises(LLMError):
        ollama_cfg("http://ollama:11434")  # no longer in the list


def test_endpoint_rejects_disallowed_base_url(ollama_env):
    from fastapi.testclient import TestClient
    from app import main
    c = TestClient(main.app, raise_server_exceptions=False)
    r = c.post("/api/test-connection", headers={"x-llm-provider": "ollama", "x-llm-base-url": "http://169.254.169.254"})
    assert r.status_code == 400 and "not allowed" in r.json()["detail"]


@pytest.mark.parametrize("handler", [
    lambda req: (_ for _ in ()).throw(httpx.ConnectError("refused 10.0.0.9:5432")),
    lambda req: (_ for _ in ()).throw(httpx.ConnectTimeout("timed out")),
    lambda req: httpx.Response(500, text="boom"),
    lambda req: httpx.Response(404, text="nope"),
    lambda req: httpx.Response(302, headers={"location": "http://169.254.169.254/"}),
    lambda req: httpx.Response(200, text="<html>not json</html>"),
])
async def test_every_ollama_failure_gives_the_same_generic_error(handler):
    p = OllamaProvider(ProviderConfig("ollama", "", "m", "http://localhost:11434"), transport=httpx.MockTransport(handler))
    with pytest.raises(LLMError) as e1:
        await p.complete("s", "p")
    with pytest.raises(LLMError) as e2:
        _ = [c async for c in p.stream("s", "p")]
    assert str(e1.value) == str(e2.value) == GENERIC_ERROR
