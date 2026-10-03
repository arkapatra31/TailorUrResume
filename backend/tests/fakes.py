from __future__ import annotations

from typing import AsyncIterator

from app.llm.base import LLMProvider
from app.schemas import (
    BridgeItem, BridgeResult, BulletRewrite, Contact, Education, Experience, JobDescription, Profile, SemanticFit,
)

SAMPLE_PROFILE = Profile(
    contact=Contact(name="Ada Lovelace", email="ada@example.com", phone="555-0100", location="London"),
    summary="Backend engineer with experience building data services.",
    experience=[
        Experience(company="Analytical Co", title="Software Engineer", start="2019", end="Present",
                   bullets=["Built REST APIs in Python and FastAPI serving 2M requests per day",
                            "Reduced query latency by 40% with PostgreSQL indexing"]),
    ],
    education=[Education(school="University of London", degree="BSc", field="Mathematics", end="2018")],
    skills=["Python", "FastAPI", "PostgreSQL", "Docker"],
)
SAMPLE_JD = JobDescription(
    title="Senior Backend Engineer", company="Acme Robotics", location="Berlin",
    must_have=["Python", "AWS", "Kubernetes"], nice_to_have=["Rust"], keywords=["FastAPI", "PostgreSQL"],
)

RESUME_MD = """# Ada Lovelace
ada@example.com | 555-0100 | London
## Summary
Backend engineer building data services.
## Experience
### Software Engineer | Analytical Co | 2019 - Present
- Built REST APIs in Python and FastAPI serving 2M requests per day
- Reduced query latency by 40% with PostgreSQL indexing
- Deployed services on Kubernetes across AWS regions
## Skills
Languages: Python, FastAPI
"""


# What a model might say about SAMPLE_JD's missing skills; grounding drops fabricated evidence.
BRIDGE = BridgeResult(items=[
    BridgeItem(skill="AWS", verdict="supported", evidence=["Lambda", "S3"], rationale="Cloud work"),  # not in profile
    BridgeItem(skill="kubernetes", verdict="partial", evidence=["Docker"], rationale="Containers"),
    BridgeItem(skill="Rust", verdict="unsupported", evidence=[], rationale="No Rust"),
])


class FakeProvider(LLMProvider):
    name = "fake"
    model = "fake-model"

    def __init__(self, stream_text: str = RESUME_MD, fail_with: Exception | None = None):
        self.stream_text = stream_text
        self.fail_with = fail_with
        self.calls: list[str] = []

    async def complete(self, system: str, prompt: str, json_mode: bool = False) -> str:
        raise NotImplementedError

    async def complete_json(self, system, prompt, schema, *, retry=True):
        self.calls.append(schema.__name__)
        if self.fail_with:
            raise self.fail_with
        if schema is Profile:
            return SAMPLE_PROFILE.model_copy(deep=True)
        if schema is JobDescription:
            return SAMPLE_JD.model_copy(deep=True)
        if schema is SemanticFit:
            return SemanticFit(score=80, strengths=["Strong Python"], gaps=["No cloud"], suggestions=["Learn AWS"])
        if schema is BridgeResult:
            return BRIDGE.model_copy(deep=True)
        if schema is BulletRewrite:
            return BulletRewrite(bullet="Built Python APIs handling 2M requests per day")
        raise AssertionError(schema)

    async def stream(self, system: str, prompt: str) -> AsyncIterator[str]:
        if self.fail_with:
            raise self.fail_with
        for i in range(0, len(self.stream_text), 40):
            yield self.stream_text[i : i + 40]

    async def ping(self) -> None:
        if self.fail_with:
            raise self.fail_with
