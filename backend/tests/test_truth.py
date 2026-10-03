from app.schemas import DocItem, DocSection, Document
from app.tailor.generate import parse_markdown
from app.tailor.truth import check_document
from tests.fakes import RESUME_MD, SAMPLE_JD, SAMPLE_PROFILE


def doc_with(bullets):
    return Document(kind="resume", name="Ada Lovelace",
                    sections=[DocSection(title="Experience", items=[DocItem(heading="Engineer", bullets=bullets)])])


def test_catches_fake_skill_from_jd():
    flags = check_document(SAMPLE_PROFILE, doc_with(["Deployed services on Kubernetes across AWS"]), SAMPLE_JD)
    assert len(flags) == 1
    assert {"Kubernetes", "AWS"} <= set(flags[0].unsupported)


def test_catches_fake_tech_without_jd():
    flags = check_document(SAMPLE_PROFILE, doc_with(["Wrote Terraform modules"]))
    assert flags and "Terraform" in flags[0].unsupported


def test_catches_invented_metric():
    flags = check_document(SAMPLE_PROFILE, doc_with(["Cut latency by 73%"]))
    assert flags and "73" in flags[0].unsupported[0]


def test_supported_claims_pass():
    flags = check_document(SAMPLE_PROFILE, doc_with([
        "Built REST APIs in Python and FastAPI serving 2M requests per day",
        "Reduced query latency by 40% with PostgreSQL indexing",
        "Containerised services with Docker",
    ]), SAMPLE_JD)
    assert flags == []


def test_parse_markdown_and_flag_location():
    doc = parse_markdown(RESUME_MD, "resume")
    assert doc.name == "Ada Lovelace" and doc.contact[0] == "ada@example.com"
    exp = next(s for s in doc.sections if s.title == "Experience")
    assert exp.items[0].dates == "2019 - Present" and len(exp.items[0].bullets) == 3
    flags = check_document(SAMPLE_PROFILE, doc, SAMPLE_JD)
    assert [f.bullet for f in flags] == [2]
