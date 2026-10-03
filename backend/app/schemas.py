"""Pydantic models. Requests carry all state; the server keeps none."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class Contact(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    links: list[str] = Field(default_factory=list)


class Experience(BaseModel):
    company: str = ""
    title: str = ""
    location: str = ""
    start: str = ""
    end: str = ""
    bullets: list[str] = Field(default_factory=list)


class Project(BaseModel):
    name: str = ""
    description: str = ""
    tech: list[str] = Field(default_factory=list)
    bullets: list[str] = Field(default_factory=list)


class Education(BaseModel):
    school: str = ""
    degree: str = ""
    field: str = ""
    start: str = ""
    end: str = ""
    details: list[str] = Field(default_factory=list)


class Profile(BaseModel):
    contact: Contact = Field(default_factory=Contact)
    summary: str = ""
    experience: list[Experience] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    publications: list[str] = Field(default_factory=list)


class JobDescription(BaseModel):
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


class SemanticFit(BaseModel):
    score: float = Field(0, ge=0, le=100)
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


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


class BulletRewrite(BaseModel):
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


class GenerateRequest(BaseModel):
    kind: DocKind = "resume"
    profile: Profile
    jd: JobDescription
    match: Optional[MatchResult] = None
    instructions: str = ""


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
