"""Truthfulness guard: flag claims in generated text not traceable to the profile."""
from __future__ import annotations

import re
from typing import Optional

from ..schemas import Document, JobDescription, Profile, TruthFlag
from .text import STOP, norm, profile_text, term_in, tokens, vocab

# Well-known technologies: lowercase mentions of these must be backed by the profile.
TECH = set(
    """python java javascript typescript go golang rust ruby php swift kotlin scala c++ c# sql nosql
    react angular vue svelte node.js django flask fastapi spring rails laravel docker kubernetes
    terraform ansible jenkins aws azure gcp postgresql mysql mongodb redis kafka rabbitmq spark
    hadoop airflow snowflake tableau powerbi pytorch tensorflow keras pandas numpy graphql grpc
    elasticsearch kibana grafana prometheus datadog splunk salesforce sap jira figma linux git
    github gitlab bitbucket cicd devops mlops llm nlp""".split()
)
COMMON_CAPS = set(
    """i i'm i've my the a an and or in on at for with to of by as we our team teams led built
    managed developed designed created implemented delivered improved reduced increased drove
    january february march april may june july august september october november december present
    dear sincerely regards best thank thanks""".split()
)
NUM_RE = re.compile(r"\$?\d[\d,]*(?:\.\d+)?")


def _numbers(text: str) -> set[str]:
    return {m.replace(",", "").rstrip(".") for m in NUM_RE.findall(text)}


def _unsupported(text: str, voc: set[str], low: str, nums: set[str], extra: set[str], jd_terms: list[str]) -> list[str]:
    bad: list[str] = []
    seen: set[str] = set()

    def add(x: str) -> None:
        if x.lower() not in seen:
            seen.add(x.lower())
            bad.append(x)

    tl = text.lower()
    # 1. JD terms asserted in the text but absent from the profile.
    for term in jd_terms:
        t = term.strip()
        if not t or len(t) < 2:
            continue
        if re.search(r"(?<![a-z0-9])" + re.escape(t.lower()) + r"(?![a-z0-9])", tl) and not term_in(t, voc, low):
            if norm(t) not in extra:
                add(t)
    # 2. Numbers (metrics) that never appear in the profile.
    for n in _numbers(text):
        core = n.lstrip("$")
        if core and core not in nums and not re.search(r"\b" + re.escape(core) + r"\+?\s*years?\b", tl):
            add(n)
    # 3. Technologies and mid-sentence proper-noun-ish tokens.
    words = list(re.finditer(r"[A-Za-z][A-Za-z0-9\+\#\.]*(?:[\-/][A-Za-z0-9\+\#\.]+)*", text))
    for m in words:
        w = m.group(0).rstrip(".")
        n = norm(w)
        if n in voc or n in extra or n in STOP or w.lower() in COMMON_CAPS or len(w) < 2:
            continue
        before = text[: m.start()].rstrip()
        sentence_start = not before or before[-1] in ".!?:\n"
        is_tech = n in TECH
        shaped = bool(re.search(r"[A-Z].*[A-Z]|[\+\#]", w)) and not w.isupper() or (w.isupper() and len(w) >= 3)
        capitalised = w[0].isupper() and not sentence_start
        if is_tech or capitalised or shaped:
            if not any(part in voc for part in re.split(r"[\-/]", n) if len(part) > 2) or is_tech:
                add(w)
    return bad


def check_document(profile: Profile, doc: Document, jd: Optional[JobDescription] = None) -> list[TruthFlag]:
    corpus = profile_text(profile)
    low = corpus.lower()
    voc = vocab(corpus)
    nums = _numbers(corpus)
    extra: set[str] = set(norm(t) for t in tokens(doc.name))
    for c in doc.contact:
        extra |= {norm(t) for t in tokens(c)}
    jd_terms: list[str] = []
    if jd:
        for field in (jd.title, jd.company, jd.location):
            extra |= {norm(t) for t in tokens(field)}
        jd_terms = [*jd.must_have, *jd.nice_to_have, *jd.keywords]
    # Contact details / skills lines in the profile also count as supported.
    flags: list[TruthFlag] = []
    for si, s in enumerate(doc.sections):
        for pi, para in enumerate(s.paragraphs):
            bad = _unsupported(para, voc, low, nums, extra, jd_terms)
            if bad:
                flags.append(TruthFlag(text=para, section=si, item=-1, bullet=pi, unsupported=bad))
        for ii, it in enumerate(s.items):
            for bi, b in enumerate(it.bullets):
                bad = _unsupported(b, voc, low, nums, extra, jd_terms)
                if bad:
                    flags.append(TruthFlag(text=b, section=si, item=ii, bullet=bi, unsupported=bad))
            if it.note:
                bad = _unsupported(it.note, voc, low, nums, extra, jd_terms)
                if bad:
                    flags.append(TruthFlag(text=it.note, section=si, item=ii, bullet=-1, unsupported=bad))
    return flags


def check_text(profile: Profile, text: str, jd: Optional[JobDescription] = None) -> list[str]:
    corpus = profile_text(profile)
    extra: set[str] = set()
    jd_terms: list[str] = []
    if jd:
        for field in (jd.title, jd.company, jd.location):
            extra |= {norm(t) for t in tokens(field)}
        jd_terms = [*jd.must_have, *jd.nice_to_have, *jd.keywords]
    return _unsupported(text, vocab(corpus), corpus.lower(), _numbers(corpus), extra, jd_terms)
