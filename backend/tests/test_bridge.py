from app.schemas import (
    AttestedSkill, BridgeItem, BridgeResult, DocItem, DocSection, Document, GenerateRequest, JobDescription,
    MatchResult,
)
from app.tailor.generate import build_prompt
from app.tailor.truth import check_document
from tests.fakes import SAMPLE_JD, SAMPLE_PROFILE
from tests.test_api import H

GENAI_JD = JobDescription(title="AI Engineer", must_have=["Gen AI", "Prompt Engineering", "Java"], keywords=["Python"])


def genai_profile(*attested: AttestedSkill):
    p = SAMPLE_PROFILE.model_copy(deep=True)
    p.skills += ["LangChain", "Claude SDK", "RAG"]
    p.attested_skills = list(attested)
    return p


def doc_with(*bullets):
    return Document(kind="resume", name="Ada Lovelace",
                    sections=[DocSection(title="Experience", items=[DocItem(heading="Engineer", bullets=list(bullets))])])


def test_bridge_endpoint_shape_and_grounding(client):
    r = client.post("/api/bridge", headers=H, json={
        "profile": SAMPLE_PROFILE.model_dump(), "jd": SAMPLE_JD.model_dump(), "missing": ["AWS", "Kubernetes", "Rust", "Go"]})
    assert r.status_code == 200
    items = {i["skill"]: i for i in r.json()["items"]}
    assert list(items) == ["AWS", "Kubernetes", "Rust", "Go"]
    assert set(items["AWS"]) == {"skill", "verdict", "evidence", "rationale"}
    # Evidence not in the profile is dropped, so the "supported" claim collapses.
    assert items["AWS"]["verdict"] == "unsupported" and items["AWS"]["evidence"] == []
    # A different technology is transferable at best.
    assert items["Kubernetes"]["verdict"] == "partial" and items["Kubernetes"]["evidence"] == ["Docker"]
    assert items["Rust"]["verdict"] == "unsupported"
    assert items["Go"]["verdict"] == "unsupported"  # the model skipped it


def test_bridge_supports_umbrella_skill(provider, client):
    provider_result = BridgeResult(items=[
        BridgeItem(skill="Gen AI", verdict="supported", evidence=["LangChain", "Claude SDK"]),
        BridgeItem(skill="Java", verdict="partial", evidence=["Python"]),  # LLM decides Python != Java
    ])
    provider.complete_json = lambda *a, **k: _async(provider_result)
    r = client.post("/api/bridge", headers=H, json={
        "profile": genai_profile().model_dump(), "jd": GENAI_JD.model_dump(), "missing": ["Gen AI", "Java"]})
    items = {i["skill"]: i for i in r.json()["items"]}
    assert items["Gen AI"]["verdict"] == "supported"
    assert items["Java"]["verdict"] == "partial"  # LLM correctly judges Python != Java


async def _async(v):
    return v


def test_bridge_implies_sql_from_postgres(provider, client):
    profile = SAMPLE_PROFILE.model_copy(deep=True)
    profile.skills += ["Postgres"]
    provider_result = BridgeResult(items=[
        BridgeItem(skill="SQL", verdict="supported", evidence=["Postgres"]),
    ])
    provider.complete_json = lambda *a, **k: _async(provider_result)
    r = client.post("/api/bridge", headers=H, json={
        "profile": profile.model_dump(), "jd": SAMPLE_JD.model_dump(), "missing": ["SQL"]})
    items = {i["skill"]: i for i in r.json()["items"]}
    assert items["SQL"]["verdict"] == "supported"  # Postgres implies SQL


def test_bridge_empty_missing_skips_llm(provider, client):
    r = client.post("/api/bridge", headers=H, json={"profile": SAMPLE_PROFILE.model_dump(), "jd": SAMPLE_JD.model_dump()})
    assert r.json() == {"items": []} and provider.calls == []


def test_approved_skills_leave_do_not_claim_list():
    match = MatchResult(score=50, keyword_score=40, semantic_score=60, matched=["Python"],
                        missing=["Gen AI", "Prompt Engineering", "Java"])
    profile = genai_profile(AttestedSkill(skill="gen ai", evidence="LangChain, Claude SDK"))
    _, prompt = build_prompt(GenerateRequest(profile=profile, jd=GENAI_JD, match=match))
    dont = next(line for line in prompt.splitlines() if "do not claim" in line)
    assert "Gen AI" not in dont and "Java" in dont and "Prompt Engineering" in dont
    assert "User-confirmed skills" in prompt and "gen ai (evidence: LangChain, Claude SDK)" in prompt


def test_truth_passes_approved_and_flags_unapproved():
    doc = doc_with("Built Gen AI assistants with LangChain", "Wrote Java services")
    before = check_document(genai_profile(), doc, GENAI_JD)
    assert any("Gen AI" in f.unsupported for f in before)
    profile = genai_profile(AttestedSkill(skill="Gen AI", evidence="LangChain, Claude SDK"))
    flags = check_document(profile, doc, GENAI_JD)
    assert [f.bullet for f in flags] == [1] and "Java" in flags[0].unsupported and flags[0].level == "warn"


def test_self_attested_gets_info_flag():
    profile = genai_profile(AttestedSkill(skill="Prompt Engineering", evidence="Daily prompt work", self_attested=True))
    flags = check_document(profile, doc_with("Applied prompt engineering to support bots"), GENAI_JD)
    assert len(flags) == 1 and flags[0].level == "info" and flags[0].unsupported == ["Prompt Engineering"]


def test_parser_never_fills_attested(client, provider):
    from tests.test_api import make_docx
    r = client.post("/api/profile/parse", headers=H, files={"file": ("cv.docx", make_docx())})
    assert r.json()["attested_skills"] == []
