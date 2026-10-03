"""Skill bridges: for each job skill missing from the profile, judge whether related experience
the candidate already has genuinely supports it (e.g. Gen AI <- LangChain, RAG, Claude SDK).

The model's verdicts are re-checked here: evidence must literally appear in the profile, and a
specific technology (Java, Kubernetes...) is never "supported" by a different one. The user then
decides what to include; nothing is added to their documents automatically.
"""
from __future__ import annotations

from ..llm.base import LLMProvider
from ..schemas import BridgeItem, BridgeRequest, BridgeResult
from .text import norm, profile_text, term_in, vocab
from .truth import TECH

SYSTEM = (
    "You are a strict, honest career coach. For each job skill the candidate's profile does not "
    "name, decide whether experience ALREADY in the profile genuinely demonstrates it:\n"
    "- supported: the profile shows clear hands-on work that is an instance of, or directly "
    "implies, the skill (e.g. 'Generative AI' <- LangChain, RAG, LLM apps, Claude SDK).\n"
    "- partial: closely related or transferable work, but not the skill itself.\n"
    "- unsupported: nothing in the profile shows it. A different language or framework does "
    "NOT demonstrate a specific one (Python does not demonstrate Java).\n"
    "evidence: exact skills, tools or short phrases copied verbatim from the profile (empty when "
    "unsupported). rationale: one short sentence. Never invent experience. Return one item per "
    "skill, in the order given, with the skill spelled exactly as given."
)


def _ground(item: BridgeItem, voc: set[str], low: str) -> BridgeItem:
    evidence = [e.strip() for e in item.evidence if e.strip() and term_in(e.strip(), voc, low)]
    verdict = item.verdict if evidence else "unsupported"
    is_tech = bool({item.skill.strip().lower(), norm(item.skill)} & TECH)
    if verdict == "supported" and is_tech and not term_in(item.skill, vocab(" ".join(evidence)), " ".join(evidence).lower()):
        verdict = "partial"  # related tech is transferable, not the same skill
    rationale = item.rationale.strip()
    if verdict == "unsupported" and item.verdict != "unsupported":
        rationale = "No matching experience found in your profile."
    return BridgeItem(skill=item.skill, verdict=verdict, evidence=evidence if verdict != "unsupported" else [],
                      rationale=rationale)


async def bridge_gaps(provider: LLMProvider, req: BridgeRequest) -> BridgeResult:
    missing = list(dict.fromkeys(s.strip() for s in req.missing if s.strip()))
    if not missing:
        return BridgeResult()
    # Ground against what the profile itself says, not against earlier attestations.
    base = req.profile.model_copy(update={"attested_skills": []})
    corpus = profile_text(base)
    prompt = (
        f"MISSING JOB SKILLS: {missing}\nGAPS NOTED EARLIER: {req.gaps}\n\n"
        f"PROFILE:\n{base.model_dump_json()}\n\nJOB:\n{req.jd.model_dump_json()}"
    )
    out = await provider.complete_json(SYSTEM, prompt, BridgeResult)
    by_skill = {i.skill.strip().lower(): i for i in out.items if i.skill.strip()}
    voc, low = vocab(corpus), corpus.lower()
    items = []
    for skill in missing:
        got = by_skill.get(skill.lower()) or BridgeItem(skill=skill)
        items.append(_ground(got.model_copy(update={"skill": skill}), voc, low))
    return BridgeResult(items=items)
