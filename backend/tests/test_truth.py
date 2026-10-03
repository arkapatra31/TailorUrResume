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


# ---------------------------------------------------------------- adversarial cases
import pytest

from app.schemas import Contact, Education, Experience, JobDescription, Profile
from app.tailor import truth


@pytest.fixture(autouse=True)
def _fixed_year(monkeypatch):
    monkeypatch.setattr(truth, "_current_year", lambda: 2024)


def item_doc(heading="", subheading="", dates="", bullets=(), title="Experience", paragraphs=()):
    return Document(kind="resume", name="Ada Lovelace", sections=[
        DocSection(title=title, paragraphs=list(paragraphs),
                   items=[DocItem(heading=heading, subheading=subheading, dates=dates, bullets=list(bullets))])])


def header_flags(flags):
    return [f for f in flags if f.bullet == -2]


def test_correct_header_passes_in_either_order():
    for h, sh in (("Software Engineer", "Analytical Co"), ("Analytical Co", "Software Engineer")):
        assert check_document(SAMPLE_PROFILE, item_doc(h, sh, "2019 - Present")) == []


def test_invented_senior_google_role_is_flagged():
    flags = header_flags(check_document(SAMPLE_PROFILE, item_doc("Senior Software Engineer", "Google", "2019 - Present")))
    assert len(flags) == 1 and {"Senior", "Google"} <= set(flags[0].unsupported)


def test_real_title_at_invented_company_is_flagged():
    flags = header_flags(check_document(SAMPLE_PROFILE, item_doc("Software Engineer", "Initech", "2019 - Present")))
    assert flags and "Initech" in flags[0].unsupported


def test_company_and_title_from_different_entries_are_flagged():
    p = SAMPLE_PROFILE.model_copy(deep=True)
    p.experience.append(Experience(company="Babbage Ltd", title="Data Analyst", start="2015", end="2018"))
    flags = header_flags(check_document(p, item_doc("Data Analyst", "Analytical Co", "2015 - 2018")))
    assert flags


def test_invented_dates_are_flagged_for_a_real_role():
    flags = header_flags(check_document(SAMPLE_PROFILE, item_doc("Software Engineer", "Analytical Co", "2012 - 2016")))
    assert flags and {"2012", "2016"} <= set(flags[0].unsupported)


def test_present_requires_an_ongoing_role():
    p = SAMPLE_PROFILE.model_copy(deep=True)
    p.experience[0].end = "2021"
    flags = header_flags(check_document(p, item_doc("Software Engineer", "Analytical Co", "2019 - Present")))
    assert flags and "Present" in flags[0].unsupported


def test_invented_month_is_flagged():
    flags = header_flags(check_document(SAMPLE_PROFILE, item_doc("Software Engineer", "Analytical Co", "Mar 2019 - Present")))
    assert flags and any(u.lower().startswith("mar") for u in flags[0].unsupported)


def test_education_header_checked():
    ok = item_doc("BSc Mathematics", "University of London", "2018", title="Education")
    assert check_document(SAMPLE_PROFILE, ok) == []
    bad = item_doc("PhD Physics", "MIT", "2018", title="Education")
    assert header_flags(check_document(SAMPLE_PROFILE, bad))


def test_skills_category_items_are_not_treated_as_roles():
    doc = item_doc("Languages", "", "", ["Python"], title="Skills")
    assert header_flags(check_document(SAMPLE_PROFILE, doc)) == []


def test_years_claim_not_blanket_exempt():
    # profile: 2019 -> 2024 (patched year) = 5 years
    bad = check_document(SAMPLE_PROFILE, doc_with(["Led platform work with 12 years of Python experience"]))
    assert bad and any("12 years" in u for u in bad[0].unsupported)
    assert check_document(SAMPLE_PROFILE, doc_with(["Brought 4 years of Python experience to the team"])) == []
    assert check_document(SAMPLE_PROFILE, doc_with(["5+ years building Python services"])) == []


def test_spelled_out_years_are_checked_too():
    bad = check_document(SAMPLE_PROFILE, doc_with(["Over fifteen years of experience in Python"]))
    assert bad and any("fifteen years" in u for u in bad[0].unsupported)


def test_years_literally_stated_in_profile_are_allowed():
    p = SAMPLE_PROFILE.model_copy(deep=True)
    p.summary = "Engineer with 10 years of experience."
    assert check_document(p, doc_with(["Applied 10 years of Python knowledge"])) == []


def test_whitelist_comes_from_profile_contact_not_generated_doc():
    # A model-invented name/contact line must not whitelist tokens used in bullets.
    doc = Document(kind="resume", name="Ada Lovelace", contact=["ada@example.com", "Zurich"],
                   sections=[DocSection(title="Experience", items=[DocItem(heading="", bullets=["Moved the team to Zurich"])])])
    flags = check_document(SAMPLE_PROFILE, doc)
    assert any("Zurich" in f.unsupported for f in flags if f.bullet >= 0)
    assert any(f.item == -1 and f.bullet == -1 and f.section == -1 for f in flags)  # contact line flagged


def test_profile_contact_tokens_are_whitelisted():
    p = SAMPLE_PROFILE.model_copy(deep=True)
    p.contact = Contact(name="Ada Lovelace", email="ada@example.com", location="London", links=["github.com/adal"])
    doc = Document(kind="resume", name="Ada Lovelace", contact=["ada@example.com", "London", "github.com/adal"],
                   sections=[DocSection(title="Experience", items=[DocItem(bullets=["Open source work at github.com/adal"])])])
    assert check_document(p, doc) == []


def test_changed_name_is_flagged():
    doc = Document(kind="resume", name="Grace Hopper")
    assert any(f.section == -1 for f in check_document(SAMPLE_PROFILE, doc))


JD = JobDescription(title="Senior Backend Engineer", company="Acme Robotics", location="Berlin")


def test_jd_company_and_title_not_allowed_in_experience_items():
    flags = check_document(SAMPLE_PROFILE, doc_with(["Worked at Acme Robotics on Berlin deployments"]), JD)
    assert flags and {"Acme", "Robotics", "Berlin"} <= set(flags[0].unsupported)


def test_jd_company_allowed_in_cover_letter_paragraphs():
    doc = Document(kind="cover_letter", name="Ada Lovelace", sections=[DocSection(
        title="Letter", paragraphs=["I am excited to apply for the Senior Backend Engineer role at Acme Robotics in Berlin."])])
    assert check_document(SAMPLE_PROFILE, doc, JD) == []


def test_regenerated_bullet_does_not_whitelist_jd_company():
    assert truth.check_text(SAMPLE_PROFILE, "Built robots for Acme Robotics", JD)


@pytest.mark.parametrize("bullet", [
    "Applied Clean Code principles during Code Review",
    "Carried the On-Call rotation for the API platform",
    "Practised Test-Driven Development and Pair Programming",
    "Improved Customer Success reporting",
])
def test_common_title_case_phrases_are_not_false_positives(bullet):
    assert check_document(SAMPLE_PROFILE, doc_with([bullet])) == []


def test_real_unknown_proper_nouns_still_flagged():
    flags = check_document(SAMPLE_PROFILE, doc_with(["Partnered with Stripe and Shopify engineers"]))
    assert flags and {"Stripe", "Shopify"} <= set(flags[0].unsupported)
