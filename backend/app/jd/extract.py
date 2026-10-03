from __future__ import annotations

from .. import config
from ..llm.base import LLMProvider
from ..schemas import JobDescription

SYSTEM = (
    "You extract structured data from job postings. Be faithful to the text; do not invent "
    "requirements. 'must_have' and 'nice_to_have' are concise skill/tool/qualification phrases "
    "(e.g. 'Python', 'AWS', '5+ years backend'). 'keywords' are ATS keywords (tools, methods, "
    "domain terms) appearing in the posting. 'seniority' is one of intern, junior, mid, senior, "
    "staff, lead, manager, executive, or empty."
)


async def extract_jd(provider: LLMProvider, text: str, source_url: str = "") -> JobDescription:
    text = text.strip()[: config.MAX_TEXT_CHARS]
    jd = await provider.complete_json(SYSTEM, f"Job posting:\n\n{text}", JobDescription)
    jd.source_url = source_url
    return jd
