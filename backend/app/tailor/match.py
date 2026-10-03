from __future__ import annotations

from ..llm.base import LLMProvider
from ..schemas import JobDescription, MatchResult, Profile, SemanticFit
from .text import profile_text, term_in, vocab

KEYWORD_WEIGHT = 0.55


def keyword_coverage(profile: Profile, jd: JobDescription) -> tuple[int, list[str], list[str]]:
    corpus = profile_text(profile)
    low = corpus.lower()
    voc = vocab(corpus)
    weighted: dict[str, int] = {}
    for t in jd.keywords:
        weighted.setdefault(t.strip(), 1)
    for t in jd.nice_to_have:
        weighted[t.strip()] = 1
    for t in jd.must_have:
        weighted[t.strip()] = 3
    weighted.pop("", None)
    if not weighted:
        return 0, [], []
    matched, missing, got, total = [], [], 0, 0
    seen: set[str] = set()
    for term, w in weighted.items():
        if term.lower() in seen:
            continue
        seen.add(term.lower())
        total += w
        if term_in(term, voc, low):
            matched.append(term)
            got += w
        else:
            missing.append(term)
    return round(100 * got / total), matched, missing


SYSTEM = (
    "You are an ATS and recruiter-grade evaluator. Compare the candidate profile with the job "
    "description and rate semantic fit 0-100 (seniority, domain, scope, impact), then list "
    "strengths, gaps and concrete, truthful suggestions (e.g. which existing experience to "
    "emphasise, what to learn). Never suggest fabricating experience."
)


async def analyze_match(provider: LLMProvider, profile: Profile, jd: JobDescription) -> MatchResult:
    kw, matched, missing = keyword_coverage(profile, jd)
    prompt = (
        f"PROFILE:\n{profile.model_dump_json()}\n\nJOB:\n{jd.model_dump_json()}\n\n"
        f"Keywords already matched: {matched}\nKeywords not found: {missing}"
    )
    fit = await provider.complete_json(SYSTEM, prompt, SemanticFit)
    sem = round(fit.score)
    score = round(KEYWORD_WEIGHT * kw + (1 - KEYWORD_WEIGHT) * sem)
    return MatchResult(
        score=max(0, min(100, score)),
        keyword_score=kw,
        semantic_score=sem,
        matched=matched,
        missing=missing,
        strengths=fit.strengths,
        gaps=fit.gaps,
        suggestions=fit.suggestions,
    )
