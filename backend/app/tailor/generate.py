"""Resume / CV / cover-letter generation (streamed) and per-bullet regeneration."""
from __future__ import annotations

import re
from typing import AsyncIterator

from ..llm.base import LLMProvider
from ..schemas import (
    BulletRewrite, DocItem, DocKind, DocSection, Document, GenerateRequest,
    JobDescription, Profile, RegenerateBulletRequest,
)
from .truth import check_document, check_text

RULES = (
    "ABSOLUTE RULES: use ONLY facts present in the candidate profile. Never invent employers, "
    "titles, dates, degrees, skills, tools, metrics or numbers. You may reorder, condense and "
    "rephrase, and mirror the job's wording ONLY where the profile genuinely supports it. If the "
    "job asks for something the candidate lacks, simply do not claim it."
)

FORMAT = """OUTPUT FORMAT (plain Markdown subset, no code fences, nothing else):
# Full Name
email | phone | location | link
## Section Title
Free paragraph text for summaries or skill lines such as: Languages: Python, Go
### Heading | Subheading | Dates
- bullet starting with a strong verb
Use '###' entries for roles, projects and education (Heading = role or degree, Subheading = company or school, Dates optional)."""

KIND_PROMPT = {
    "resume": (
        "Write a tailored, ATS-friendly RESUME that fits one page (two at most): a 2-3 line "
        "Summary, Skills (prioritise job-relevant ones), Experience (most relevant bullets "
        "first, 2-5 bullets per role, quantified only when the profile quantifies), Projects "
        "(only if relevant), Education, Certifications if relevant."
    ),
    "cv": (
        "Write a complete long-form CV: tailored Summary, Skills, full Experience with all "
        "roles, Projects, Education, Certifications and Publications when present. Keep every "
        "role; order and emphasise by relevance to the job."
    ),
    "cover_letter": (
        "Write a concise, specific COVER LETTER (3-4 short paragraphs, under 350 words) "
        "addressed to the hiring team at the company. Use the header lines, then exactly one "
        "section '## Letter' whose body is the paragraphs, starting with a greeting and ending "
        "with a sign-off and the candidate's name, each as its own paragraph line."
    ),
}


def build_prompt(req: GenerateRequest) -> tuple[str, str]:
    system = f"You are an expert resume writer. {RULES}\n\n{FORMAT}"
    extra = f"\nExtra user instructions: {req.instructions}" if req.instructions else ""
    miss = f"\nJob skills NOT in the profile (do not claim): {req.match.missing}" if req.match else ""
    prompt = (
        f"{KIND_PROMPT[req.kind]}{extra}{miss}\n\nCANDIDATE PROFILE (JSON):\n{req.profile.model_dump_json()}"
        f"\n\nTARGET JOB (JSON):\n{req.jd.model_dump_json()}"
    )
    return system, prompt


def parse_markdown(text: str, kind: DocKind) -> Document:
    text = re.sub(r"^```\w*\n|\n```\s*$", "", text.strip())
    doc = Document(kind=kind)
    section: DocSection | None = None
    item: DocItem | None = None
    header_lines: list[str] = []
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        s = line.strip()
        if s.startswith("### "):
            if section is None:
                section = DocSection(title="")
                doc.sections.append(section)
            parts = [p.strip() for p in s[4:].split(" | ")]
            item = DocItem(heading=parts[0], subheading=parts[1] if len(parts) > 1 else "",
                           dates=parts[2] if len(parts) > 2 else "")
            if len(parts) > 3:
                item.dates = parts[-1]
                item.subheading = " | ".join(parts[1:-1])
            section.items.append(item)
        elif s.startswith("## "):
            section = DocSection(title=s[3:].strip())
            doc.sections.append(section)
            item = None
        elif s.startswith("# "):
            doc.name = s[2:].strip()
        elif section is None:
            header_lines.append(s)
        elif re.match(r"^[-*•]\s+", s):
            b = re.sub(r"^[-*•]\s+", "", s)
            if item is None:
                item = DocItem()
                section.items.append(item)
            item.bullets.append(b)
        else:
            if item is not None and section.items and item is section.items[-1] and item.heading:
                item.note = (item.note + " " + s).strip()
            else:
                section.paragraphs.append(s)
    for h in header_lines:
        doc.contact += [c.strip() for c in re.split(r"\s+[|·•]\s+|\s*\|\s*", h) if c.strip()]
    return doc


async def generate_events(provider: LLMProvider, req: GenerateRequest) -> AsyncIterator[dict]:
    system, prompt = build_prompt(req)
    buf: list[str] = []
    async for chunk in provider.stream(system, prompt):
        buf.append(chunk)
        yield {"event": "token", "data": {"text": chunk}}
    doc = parse_markdown("".join(buf), req.kind)
    flags = check_document(req.profile, doc, req.jd)
    yield {
        "event": "done",
        "data": {"doc": doc.model_dump(), "flags": [f.model_dump() for f in flags]},
    }


BULLET_SYSTEM = (
    f"You rewrite a single resume bullet for a target job. {RULES} Keep it to one line "
    "(max ~28 words), start with a strong verb, no trailing period required."
)


async def regenerate_bullet(provider: LLMProvider, req: RegenerateBulletRequest) -> tuple[str, list[str]]:
    prompt = (
        f"Section context: {req.context}\nCurrent bullet: {req.bullet}\n"
        f"User instruction: {req.instruction or 'Make it stronger and better aligned to the job.'}\n\n"
        f"PROFILE:\n{req.profile.model_dump_json()}\n\nJOB:\n{req.jd.model_dump_json()}"
    )
    out = await provider.complete_json(BULLET_SYSTEM, prompt, BulletRewrite)
    new = out.bullet.strip().lstrip("-*• ").strip()
    return new, check_text(req.profile, new, req.jd)
