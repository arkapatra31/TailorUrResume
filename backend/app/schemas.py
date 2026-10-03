"""Pydantic models. Requests carry all state; the server keeps none."""
from __future__ import annotations

from typing import Literal, Optional

from typing import Any, get_origin

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Lenient(BaseModel):
    """Base for models filled by an LLM: tolerate the usual sloppiness instead of failing validation.

    * null / missing values fall back to the field default (nulls inside lists are dropped)
    * numbers given for text fields become text ("2019" not 2019)
    * a lone string given for a list field becomes a one-item list
    """

    model_config = ConfigDict(coerce_numbers_to_str=True)

    @model_validator(mode="before")
    @classmethod
    def _tolerate(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        out: dict[str, Any] = {}
        for k, v in data.items():
            if v is None:
                continue
            f = cls.model_fields.get(k)
            if isinstance(v, list):
                v = [x for x in v if x is not None]
            elif isinstance(v, str) and f is not None and get_origin(f.annotation) is list:
                v = [v] if v.strip() else []
            out[k] = v
        return out


class Contact(Lenient):
    name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    links: list[str] = Field(default_factory=list)


class Experience(Lenient):
    company: str = ""
    title: str = ""
    location: str = ""
    start: str = ""
    end: str = ""
    bullets: list[str] = Field(default_factory=list)


class Project(Lenient):
    name: str = ""
    description: str = ""
    tech: list[str] = Field(default_factory=list)
    bullets: list[str] = Field(default_factory=list)


class Education(Lenient):
    school: str = ""
    degree: str = ""
    field: str = ""
    start: str = ""
    end: str = ""
    details: list[str] = Field(default_factory=list)


class AttestedSkill(Lenient):
    """A job skill missing from the profile that the user explicitly approved for their documents."""
    skill: str = ""
    evidence: str = ""
    #: True when the user included it although the bridge found no support in the profile.
    self_attested: bool = False


class Profile(Lenient):
    contact: Contact = Field(default_factory=Contact)
    summary: str = ""
    experience: list[Experience] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    publications: list[str] = Field(default_factory=list)
    #: User-approved skill bridges. Never filled by the profile parser.
    attested_skills: list[AttestedSkill] = Field(default_factory=list)


class JobDescription(Lenient):
    title: str = ""
    company: str = ""
    location: str = ""
    seniority: str = ""
    summary: str = ""
    must_have: list[str] = Field(default_factory=list)
    nice_to_have: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    source_url: str = ""


class SemanticFit(Lenient):
    score: float = Field(0, description="0-100")
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)

    @field_validator("score", mode="before")
    @classmethod
    def _clamp(cls, v: Any) -> float:
        try:
            x = float(str(v).strip().rstrip("%"))
        except (TypeError, ValueError):
            return 0.0
        if x != x:  # NaN
            return 0.0
        return max(0.0, min(100.0, x))


class MatchResult(BaseModel):
    score: int
    keyword_score: int
    semantic_score: int
    matched: list[str]
    missing: list[str]
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class DocItem(BaseModel):
    heading: str = ""
    subheading: str = ""
    dates: str = ""
    note: str = ""
    bullets: list[str] = Field(default_factory=list)


class DocSection(BaseModel):
    title: str = ""
    paragraphs: list[str] = Field(default_factory=list)
    items: list[DocItem] = Field(default_factory=list)


DocKind = Literal["resume", "cv", "cover_letter"]


class Document(BaseModel):
    kind: DocKind = "resume"
    name: str = ""
    contact: list[str] = Field(default_factory=list)
    sections: list[DocSection] = Field(default_factory=list)


class TruthFlag(BaseModel):
    text: str
    section: int = -1
    item: int = -1
    bullet: int = -1
    unsupported: list[str]
    reason: str = "Not traceable to your profile"
    #: "warn" = not traceable to the profile; "info" = backed only by the user's own attestation.
    level: Literal["warn", "info"] = "warn"


BridgeVerdict = Literal["supported", "partial", "unsupported"]


class BridgeItem(Lenient):
    skill: str = ""
    verdict: BridgeVerdict = "unsupported"
    evidence: list[str] = Field(default_factory=list, description="Exact skills/tools/phrases from the profile")
    rationale: str = ""

    @field_validator("verdict", mode="before")
    @classmethod
    def _verdict(cls, v: Any) -> str:
        v = str(v).strip().lower()
        return v if v in ("supported", "partial", "unsupported") else "unsupported"


class BridgeResult(Lenient):
    items: list[BridgeItem] = Field(default_factory=list)


class BulletRewrite(Lenient):
    bullet: str


# ---- requests ----
class FetchRequest(BaseModel):
    url: str


class ExtractRequest(BaseModel):
    text: str
    source_url: str = ""


class MatchRequest(BaseModel):
    profile: Profile
    jd: JobDescription


class BridgeRequest(BaseModel):
    profile: Profile
    jd: JobDescription
    missing: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)


class GenerateRequest(BaseModel):
    kind: DocKind = "resume"
    profile: Profile
    jd: JobDescription
    match: Optional[MatchResult] = None
    instructions: str = ""
    #: Opt-in: let the bridge add missing job skills that existing experience genuinely supports.
    auto_bridge: bool = False


class RegenerateBulletRequest(BaseModel):
    profile: Profile
    jd: JobDescription
    bullet: str
    context: str = ""
    instruction: str = ""


class TruthRequest(BaseModel):
    profile: Profile
    doc: Document
    jd: Optional[JobDescription] = None


class ExportRequest(BaseModel):
    doc: Document
    template: Literal["classic", "modern", "compact"] = "classic"
