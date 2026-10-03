"""Truthfulness guard: flag claims in generated text not traceable to the profile.

What is checked:
  * bullets, notes and paragraphs: JD terms, metrics, technologies and proper-noun-ish tokens
  * item headings, subheadings and dates: must match a company/title/school/degree tuple and the
    date strings of the SAME profile entry (an invented "Senior Software Engineer | Google" is flagged)
  * "N years" claims: only if the profile states them or its dated experience spans them
  * the document name and contact lines: must come from the profile's contact data

Skills the user approved on the Match step (profile.attested_skills) and their evidence are part of
the profile corpus, so they pass; self-attested ones (no support found in the profile) also get an
info-level flag. Unapproved job skills are still flagged.

The whitelist of always-allowed tokens is built ONLY from the profile's contact data. The JD
title/company/location are additionally allowed in free-text paragraphs (cover letters, summaries),
never in experience items.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

from ..schemas import Document, JobDescription, Profile, TruthFlag
from .text import STOP, norm, profile_text, term_in, tokens, vocab

# Well-known technologies: mentions of these must be backed by the profile.
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
# Ordinary professional vocabulary that is routinely Title Cased ("Clean Code", "On-Call",
# "Code Review"). These are not proper nouns and must not be flagged as invented claims.
COMMON_WORDS = set(
    """clean code call calls on off review reviews open source test tests testing driven design designs
    pattern patterns practice practices principle principles best quality assurance customer customers
    success service services product products project projects program programs management manager
    engineering data cloud domain event events continuous integration delivery deployment technical
    debt incident incidents response release releases planning performance security user users
    experience interface full stack front back end cross functional remote hybrid agile unit
    code-review on-call pair programming mentoring mentorship documentation documentations
    architecture system systems software hardware web mobile application applications platform
    platforms infrastructure monitoring observability reliability scalability availability
    automation pipeline pipelines workflow workflows process processes strategy business analytics
    analysis machine learning model models research development operations support sales marketing
    finance legal compliance stakeholder stakeholders roadmap sprint sprints backlog standup
    api ui ux qa hr kpi okr sla roi saas paas crm erp sdk b2b b2c mvp poc""".split()
)
NUM_RE = re.compile(r"\$?\d[\d,]*(?:\.\d+)?")
NUM_WORDS = {w: i for i, w in enumerate(
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen "
    "sixteen seventeen eighteen nineteen twenty".split())}
YEARS_RE = re.compile(
    r"(?<![\w.])(\d{1,2}|" + "|".join(NUM_WORDS) + r")\s*\+?\s*(?:-\s*)?(?:years?|yrs?)\b", re.I)
YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")
MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
MONTH_RE = re.compile(r"\b(" + "|".join(MONTHS) + r")[a-z]*\b\.?", re.I)
PRESENT_RE = re.compile(r"\b(present|current|now|ongoing|today|to date)\b", re.I)
HEADER_FILLER = {"at", "the", "of", "and", "in", "for", "a", "an", "to", "on", "with"}
ITEM_SECTION_RE = re.compile(
    r"experience|employment|work|career|education|academic|project|certif|publication|volunteer|"
    r"training|award|history|leadership", re.I)


def _current_year() -> int:
    return date.today().year


def _numbers(text: str) -> set[str]:
    return {m.replace(",", "").rstrip(".") for m in NUM_RE.findall(text)}


# --------------------------------------------------------------------------- context
@dataclass
class Ctx:
    voc: set[str]
    low: str
    nums: set[str]
    extra: set[str]  # tokens allowed everywhere (profile contact data only)
    jd_extra: set[str] = field(default_factory=set)  # JD title/company/location: free-text paragraphs only
    jd_terms: list[str] = field(default_factory=list)
    span_years: int = 0
    claimed_years: set[int] = field(default_factory=set)


def _contact_tokens(profile: Profile) -> set[str]:
    c = profile.contact
    out: set[str] = set()
    for v in (c.name, c.email, c.phone, c.location, *c.links):
        out |= {norm(t) for t in tokens(v)}
        out |= {norm(p) for p in re.split(r"[@./:\-]+", v) if p}
    return out


def _years_of(text: str) -> list[int]:
    return [int(y) for y in YEAR_RE.findall(text)]


def _span_years(profile: Profile) -> int:
    ys: list[int] = []
    now = _current_year()
    for e in profile.experience:
        s = _years_of(e.start)
        if not s:
            continue
        end_years = _years_of(e.end)
        if PRESENT_RE.search(e.end) or not e.end.strip():
            end = now
        else:
            end = max(end_years) if end_years else max(s)
        ys += [min(s), end]
    return max(ys) - min(ys) if len(ys) >= 2 else 0


def _claimed_years(corpus: str) -> set[int]:
    out: set[int] = set()
    for m in YEARS_RE.finditer(corpus):
        v = m.group(1).lower()
        out.add(int(v) if v.isdigit() else NUM_WORDS[v])
    return out


def _build_ctx(profile: Profile, jd: Optional[JobDescription], *, paragraph: bool) -> Ctx:
    corpus = profile_text(profile)
    jd_extra: set[str] = set()
    jd_terms: list[str] = []
    if jd:
        for f in (jd.title, jd.company, jd.location):
            jd_extra |= {norm(t) for t in tokens(f)}
        jd_terms = [*jd.must_have, *jd.nice_to_have, *jd.keywords]
    ctx = Ctx(vocab(corpus), corpus.lower(), _numbers(corpus), _contact_tokens(profile), jd_extra, jd_terms,
              _span_years(profile), _claimed_years(corpus))
    if not paragraph:
        ctx.jd_extra = set()
    return ctx


# --------------------------------------------------------------------------- free text
def _years_ok(n: int, ctx: Ctx) -> bool:
    return n in ctx.claimed_years or (ctx.span_years > 0 and n <= ctx.span_years)


def _unsupported(text: str, ctx: Ctx) -> list[str]:
    voc, extra = ctx.voc, ctx.extra | ctx.jd_extra
    bad: list[str] = []
    seen: set[str] = set()

    def add(x: str) -> None:
        if x.lower() not in seen:
            seen.add(x.lower())
            bad.append(x)

    tl = text.lower()
    # 1. JD terms asserted in the text but absent from the profile.
    for term in ctx.jd_terms:
        t = term.strip()
        if len(t) < 2:
            continue
        if re.search(r"(?<![a-z0-9])" + re.escape(t.lower()) + r"(?![a-z0-9])", tl) and not term_in(t, voc, ctx.low):
            if norm(t) not in extra:
                add(t)
    # 2. "N years": only counts the profile supports.
    year_spans: list[tuple[int, int]] = []
    for m in YEARS_RE.finditer(text):
        v = m.group(1).lower()
        n = int(v) if v.isdigit() else NUM_WORDS[v]
        year_spans.append(m.span(1))
        if not _years_ok(n, ctx):
            add(m.group(0).strip())
    # 3. Numbers (metrics) that never appear in the profile.
    for m in NUM_RE.finditer(text):
        if any(a <= m.start() < b for a, b in year_spans):
            continue
        n = m.group(0).replace(",", "").rstrip(".")
        core = n.lstrip("$")
        if core and core not in ctx.nums:
            add(n)
    # 4. Technologies and mid-sentence proper-noun-ish tokens.
    for m in re.finditer(r"[A-Za-z][A-Za-z0-9\+\#\.]*(?:[\-/][A-Za-z0-9\+\#\.]+)*", text):
        w = m.group(0).rstrip(".")
        n = norm(w)
        if n in voc or n in extra or n in STOP or w.lower() in COMMON_CAPS or len(w) < 2:
            continue
        parts = [norm(p) for p in re.split(r"[\-/]", w) if p]
        before = text[: m.start()].rstrip()
        sentence_start = not before or before[-1] in ".!?:\n"
        is_tech = n in TECH or any(p in TECH for p in parts)
        if not is_tech:
            # Ordinary vocabulary ("Clean Code", "On-Call"): every part is a known word.
            if all(p in COMMON_WORDS or p in STOP or p in voc or p in extra or len(p) < 2 for p in parts):
                continue
            if n in COMMON_WORDS:
                continue
        shaped = bool(re.search(r"[A-Z].*[A-Z]", w) or re.search(r"[+#]", w) or (re.search(r"\d", w) and re.search(r"[A-Za-z]", w))) \
            and len(w) >= 2
        all_caps = w.isalpha() and w.isupper() and len(w) >= 3
        capitalised = w[0].isupper() and not sentence_start
        if is_tech or capitalised or shaped or all_caps:
            if is_tech or not any(p in voc for p in parts if len(p) > 2):
                add(w)
    return bad


# --------------------------------------------------------------------------- headers
def _htoks(s: str) -> set[str]:
    out = set()
    for t in tokens(s):
        t = t.replace(".", "")
        for p in re.split(r"[\-/]", t):
            n = norm(p)
            if n and n not in HEADER_FILLER and n not in STOP:
                out.add(n)
    return out


@dataclass
class Entry:
    toks: set[str]
    dates: str  # "start end" strings from the profile
    end: Optional[str]  # None when the entry has no end concept


def _entries(profile: Profile) -> list[Entry]:
    out: list[Entry] = []
    for e in profile.experience:
        out.append(Entry(_htoks(" ".join([e.company, e.title, e.location])), f"{e.start} {e.end}", e.end))
    for ed in profile.education:
        out.append(Entry(_htoks(" ".join([ed.school, ed.degree, ed.field])), f"{ed.start} {ed.end}", ed.end))
    for p in profile.projects:
        out.append(Entry(_htoks(" ".join([p.name, *p.tech])), "", None))
    for s in [*profile.certifications, *profile.publications]:
        out.append(Entry(_htoks(s), s, None))
    return [e for e in out if e.toks]


def _is_present(end: Optional[str]) -> bool:
    return end is not None and (not end.strip() or bool(PRESENT_RE.search(end)))


def _check_header(it, entries: list[Entry], all_dates: str, any_present: bool) -> list[str]:
    bad: list[str] = []
    words = [w for w in tokens(f"{it.heading} {it.subheading}")]
    want = _htoks(f"{it.heading} {it.subheading}")
    matching: list[Entry] = []
    if want:
        matching = [e for e in entries if want <= e.toks]
        if not matching:
            best = max(entries, key=lambda e: len(want & e.toks), default=None)
            known = best.toks if best else set()
            missing = [w for w in words if _htoks(w) and not _htoks(w) <= known]
            bad += missing or [f"{it.heading} {it.subheading}".strip()]
    if it.dates.strip():
        pool = matching or entries
        dates_txt = " ".join(e.dates for e in pool) if matching else all_dates
        ok_years = set(_years_of(dates_txt))
        ok_months = {m.group(1).lower() for m in MONTH_RE.finditer(dates_txt)}
        present_ok = any(_is_present(e.end) for e in pool) if matching else any_present
        for y in YEAR_RE.findall(it.dates):
            if int(y) not in ok_years:
                bad.append(y)
        for m in MONTH_RE.finditer(it.dates):
            if m.group(1).lower() not in ok_months:
                bad.append(m.group(0).strip("."))
        pm = PRESENT_RE.search(it.dates)
        if pm and not present_ok:
            bad.append(pm.group(0))
    return bad


# --------------------------------------------------------------------------- contact
def _digits(s: str) -> str:
    return re.sub(r"\D", "", s)


def _contact_flags(profile: Profile, doc: Document) -> list[TruthFlag]:
    c = profile.contact
    values = [v for v in (c.email, c.phone, c.location, *c.links) if v.strip()]
    flags: list[TruthFlag] = []
    if c.name.strip() and doc.name.strip() and not _htoks(doc.name) <= _htoks(c.name):
        flags.append(TruthFlag(text=doc.name, unsupported=[doc.name], reason="Name differs from your profile"))
    if not values:
        return flags
    for line in doc.contact:
        s = line.strip()
        if not s:
            continue
        ls, ds = s.lower().rstrip("/"), _digits(s)
        ok = False
        for v in values:
            lv = v.lower().strip().rstrip("/")
            lv_bare = re.sub(r"^https?://(www\.)?", "", lv)
            ls_bare = re.sub(r"^https?://(www\.)?", "", ls)
            if ls_bare == lv_bare or ls_bare in lv_bare or lv_bare in ls_bare or (ds and len(ds) >= 6 and ds == _digits(v)):
                ok = True
                break
        if not ok and c.location.strip() and _htoks(s) and _htoks(s) <= _htoks(c.location):
            ok = True
        if not ok:
            flags.append(TruthFlag(text=s, unsupported=[s], reason="Contact detail not in your profile"))
    return flags


# --------------------------------------------------------------------------- public API
def check_document(profile: Profile, doc: Document, jd: Optional[JobDescription] = None) -> list[TruthFlag]:
    para_ctx = _build_ctx(profile, jd, paragraph=True)
    item_ctx = _build_ctx(profile, jd, paragraph=False)
    entries = _entries(profile)
    all_dates = " ".join(e.dates for e in entries)
    any_present = any(_is_present(e.end) for e in entries)
    flags: list[TruthFlag] = _contact_flags(profile, doc)
    for si, s in enumerate(doc.sections):
        for pi, para in enumerate(s.paragraphs):
            bad = _unsupported(para, para_ctx)
            if bad:
                flags.append(TruthFlag(text=para, section=si, item=-1, bullet=pi, unsupported=bad))
        for ii, it in enumerate(s.items):
            if (it.heading or it.subheading or it.dates) and (ITEM_SECTION_RE.search(s.title) or it.dates.strip()):
                bad = _check_header(it, entries, all_dates, any_present)
                if bad:
                    flags.append(TruthFlag(
                        text=" | ".join(x for x in (it.heading, it.subheading, it.dates) if x), section=si, item=ii,
                        bullet=-2, unsupported=bad, reason="Role, organisation or dates not in your profile"))
            for bi, b in enumerate(it.bullets):
                bad = _unsupported(b, item_ctx)
                if bad:
                    flags.append(TruthFlag(text=b, section=si, item=ii, bullet=bi, unsupported=bad))
            if it.note:
                bad = _unsupported(it.note, item_ctx)
                if bad:
                    flags.append(TruthFlag(text=it.note, section=si, item=ii, bullet=-1, unsupported=bad))
    return flags + _self_attested_flags(profile, doc)


def _self_attested_flags(profile: Profile, doc: Document) -> list[TruthFlag]:
    """Info-level notes where the text leans on a skill only the user's own word supports."""
    skills = [a.skill.strip() for a in profile.attested_skills if a.self_attested and len(a.skill.strip()) >= 2]
    if not skills:
        return []
    flags: list[TruthFlag] = []

    def visit(text: str, si: int, ii: int, bi: int) -> None:
        tl = text.lower()
        hit = [k for k in skills if re.search(r"(?<![a-z0-9])" + re.escape(k.lower()) + r"(?![a-z0-9])", tl)]
        if hit:
            flags.append(TruthFlag(text=text, section=si, item=ii, bullet=bi, unsupported=hit, level="info",
                                   reason="Self-attested skill: be ready to back it up in an interview"))

    for si, s in enumerate(doc.sections):
        for pi, para in enumerate(s.paragraphs):
            visit(para, si, -1, pi)
        for ii, it in enumerate(s.items):
            for bi, b in enumerate(it.bullets):
                visit(b, si, ii, bi)
            if it.note:
                visit(it.note, si, ii, -1)
    return flags


def check_text(profile: Profile, text: str, jd: Optional[JobDescription] = None) -> list[str]:
    """Check a single bullet (no JD-name whitelist: bullets are experience claims)."""
    return _unsupported(text, _build_ctx(profile, jd, paragraph=False))
