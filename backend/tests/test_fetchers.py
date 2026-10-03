from pathlib import Path

import httpx
import pytest

from app.jd.fetchers import FetchError, fetch_job, greenhouse_ids, lever_ids, linkedin_job_id

FIX = Path(__file__).parent / "fixtures"


async def _ok(url):  # bypass DNS/SSRF check for mocked transports
    return None


def client_for(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_linkedin_id_parsing():
    assert linkedin_job_id("https://www.linkedin.com/jobs/view/3912345678/?trk=x") == "3912345678"
    assert linkedin_job_id("https://www.linkedin.com/jobs/view/senior-engineer-at-acme-3912345678") == "3912345678"
    assert linkedin_job_id("https://www.linkedin.com/jobs/search/?currentJobId=3912345678&x=1") == "3912345678"
    assert linkedin_job_id("https://example.com/jobs/view/3912345678") is None


def test_ats_id_parsing():
    assert greenhouse_ids("https://boards.greenhouse.io/globex/jobs/4001") == ("globex", "4001")
    assert greenhouse_ids("https://job-boards.greenhouse.io/globex/jobs/4001?gh_src=x") == ("globex", "4001")
    assert lever_ids("https://jobs.lever.co/initech/abc-123") == ("initech", "abc-123")


async def test_linkedin_fetch():
    seen = []

    def h(req):
        seen.append(str(req.url))
        return httpx.Response(200, text=(FIX / "linkedin.html").read_text())

    job = await fetch_job("https://www.linkedin.com/jobs/view/3912345678", client_for(h), _ok)
    assert seen == ["https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/3912345678"]
    assert job.source == "linkedin" and job.title == "Senior Backend Engineer"
    assert job.company == "Acme Robotics" and "Berlin" in job.location
    assert "5+ years of Python" in job.text and "- Experience with AWS" in job.text


async def test_linkedin_blocked():
    with pytest.raises(FetchError, match="refused"):
        await fetch_job("https://www.linkedin.com/jobs/view/3912345678",
                        client_for(lambda r: httpx.Response(429)), _ok)


async def test_greenhouse_fetch():
    seen = []

    def h(req):
        seen.append(str(req.url))
        return httpx.Response(200, text=(FIX / "greenhouse.json").read_text())

    job = await fetch_job("https://boards.greenhouse.io/globex/jobs/4001", client_for(h), _ok)
    assert seen == ["https://boards-api.greenhouse.io/v1/boards/globex/jobs/4001"]
    assert job.title == "Data Engineer" and "Spark" in job.text and "- SQL expertise" in job.text


async def test_lever_fetch():
    seen = []

    def h(req):
        seen.append(str(req.url))
        return httpx.Response(200, text=(FIX / "lever.json").read_text())

    job = await fetch_job("https://jobs.lever.co/initech/abc-123", client_for(h), _ok)
    assert seen == ["https://api.lever.co/v0/postings/initech/abc-123"]
    assert job.title == "Product Designer" and "Figma" in job.text and "London" in job.text


async def test_generic_fetch_readable_text():
    h = lambda r: httpx.Response(200, text=(FIX / "generic.html").read_text(), headers={"content-type": "text/html"})
    job = await fetch_job("https://careers.initrode.com/platform", client_for(h), _ok)
    assert "Platform Engineer" in job.text and "Terraform" in job.text
    assert "Copyright" not in job.text and "var x" not in job.text


async def test_generic_follows_redirect_and_404():
    def h(req):
        if req.url.path == "/a":
            return httpx.Response(302, headers={"location": "/b"})
        return httpx.Response(404)

    with pytest.raises(FetchError, match="not found"):
        await fetch_job("https://x.example/a", client_for(h), _ok)


async def test_private_address_blocked():
    with pytest.raises(FetchError, match="private"):
        await fetch_job("http://127.0.0.1:8000/secret")


def test_fetch_endpoint_error_is_422(client):
    r = client.post("/api/jd/fetch", json={"url": "https://www.linkedin.com/jobs/collections/recommended"})
    assert r.status_code == 422
