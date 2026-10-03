import json
from types import SimpleNamespace

import pytest

from app.llm.anthropic import AnthropicProvider
from app.llm.base import LLMError, LLMProvider, ProviderConfig, parse_model_json
from app.schemas import BulletRewrite, JobDescription, Profile, SemanticFit
from tests.fakes import FakeProvider, SAMPLE_JD, SAMPLE_PROFILE


class Scripted(LLMProvider):
    def __init__(self, replies):
        self.replies, self.calls = list(replies), 0

    async def complete(self, system, prompt, json_mode=False):
        self.calls += 1
        return self.replies.pop(0)

    async def stream(self, system, prompt):
        yield ""


@pytest.mark.parametrize("raw", [
    '{"score": 80, "gaps": ["a"]}',
    '```json\n{"score": 80, "gaps": ["a"]}\n```',
    '```\n{"score": 80, "gaps": ["a"]}\n```',
    'Sure! Here is the JSON you asked for:\n{"score": 80, "gaps": ["a"]}\nHope that helps {smile}',
    '{"score": 80, "gaps": ["a",],}',                         # trailing commas
    '```json\n{"score": 80,\n "gaps": ["a"],\n}\n```',
    'Note {} first. Then: {"score": 80, "gaps": ["a"]}',      # stray braces before the answer
    '```json\n{"score": 80, "gaps": ["a"]}',                  # unterminated fence
])
def test_tolerant_parsing(raw):
    m = parse_model_json(raw, SemanticFit)
    assert m.score == 80 and m.gaps == ["a"]


def test_commas_inside_strings_are_not_touched():
    m = parse_model_json('{"bullet": "Built a, b, ]x, } thing",}', BulletRewrite)
    assert m.bullet == "Built a, b, ]x, } thing"


def test_picks_the_object_that_fits_the_schema_best():
    raw = '{"unrelated": 1} then {"score": 55, "strengths": ["x"], "gaps": [], "suggestions": []}'
    assert parse_model_json(raw, SemanticFit).score == 55


def test_no_json_raises_valueerror():
    with pytest.raises(ValueError):
        parse_model_json("I cannot do that.", SemanticFit)


@pytest.mark.parametrize("val,expected", [(150, 100), (-5, 0), ("85", 85), ("90%", 90), (None, 0), ("n/a", 0), (72.5, 72.5)])
def test_score_is_clamped_and_coerced(val, expected):
    assert SemanticFit.model_validate({"score": val}).score == expected


def test_nulls_become_defaults_and_numbers_become_text():
    p = Profile.model_validate({
        "contact": None, "summary": None, "skills": ["Go", None, "Rust"], "certifications": "AWS SA",
        "experience": [{"company": "X", "title": None, "start": 2019, "end": None, "bullets": None}],
        "education": [{"school": "U", "end": 2018, "details": [None]}],
    })
    assert p.contact.name == "" and p.summary == "" and p.skills == ["Go", "Rust"] and p.certifications == ["AWS SA"]
    e = p.experience[0]
    assert (e.title, e.start, e.end, e.bullets) == ("", "2019", "", [])
    assert p.education[0].end == "2018" and p.education[0].details == []


def test_jd_with_null_lists():
    jd = JobDescription.model_validate({"title": "SRE", "must_have": None, "keywords": ["a", None], "company": None})
    assert jd.must_have == [] and jd.keywords == ["a"] and jd.company == ""


async def test_one_call_when_reply_is_sloppy_but_recoverable():
    p = Scripted(['Here you go:\n```json\n{"score": 120, "gaps": null, "strengths": ["s",],}\n```'])
    out = await p.complete_json("s", "p", SemanticFit)
    assert out.score == 100 and out.gaps == [] and out.strengths == ["s"] and p.calls == 1


async def test_repair_retry_still_used_for_real_garbage():
    p = Scripted(["no json at all", '{"bullet": "ok"}'])
    assert (await p.complete_json("s", "p", BulletRewrite)).bullet == "ok" and p.calls == 2


# ---------------------------------------------------------------- Anthropic stop_reason
class FakeStream:
    def __init__(self, chunks, stop):
        self.chunks, self.stop = chunks, stop

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    @property
    def text_stream(self):
        async def gen():
            for c in self.chunks:
                yield c
        return gen()

    async def get_final_message(self):
        return SimpleNamespace(stop_reason=self.stop)


def anthropic_provider(create=None, stream=None):
    p = AnthropicProvider(ProviderConfig("anthropic", "sk-ant-test-key-123456", "m"))
    p._client = SimpleNamespace(messages=SimpleNamespace(create=create, stream=stream))
    return p


async def test_complete_max_tokens_is_an_error():
    async def create(**kw):
        return SimpleNamespace(content=[SimpleNamespace(type="text", text='{"a":')], stop_reason="max_tokens")

    with pytest.raises(LLMError, match="cut off"):
        await anthropic_provider(create=create).complete("s", "p")


async def test_complete_end_turn_is_fine():
    async def create(**kw):
        return SimpleNamespace(content=[SimpleNamespace(type="text", text="ok")], stop_reason="end_turn")

    assert await anthropic_provider(create=create).complete("s", "p") == "ok"


async def test_stream_flags_truncation():
    p = anthropic_provider(stream=lambda **kw: FakeStream(["# Ada\n", "## Exp"], "max_tokens"))
    assert "".join([c async for c in p.stream("s", "p")]) == "# Ada\n## Exp" and p.truncated is True
    p2 = anthropic_provider(stream=lambda **kw: FakeStream(["x"], "end_turn"))
    _ = [c async for c in p2.stream("s", "p")]
    assert p2.truncated is False


def test_generate_emits_warning_event_before_done_when_truncated(client, provider):
    provider.truncated = True
    r = client.post("/api/generate", json={"kind": "resume", "profile": SAMPLE_PROFILE.model_dump(), "jd": SAMPLE_JD.model_dump()})
    names = [b.split("\n", 1)[0] for b in r.text.strip().split("\n\n")]
    assert "event: warning" in names and names[-1] == "event: done"
    assert names.index("event: warning") < names.index("event: done")
    assert "cut off" in r.text


def test_generate_has_no_warning_normally(client):
    r = client.post("/api/generate", json={"kind": "resume", "profile": SAMPLE_PROFILE.model_dump(), "jd": SAMPLE_JD.model_dump()})
    assert "event: warning" not in r.text
