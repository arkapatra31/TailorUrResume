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


# ---------------------------------------------------------------- SSRF hardening
import ipaddress

import httpcore

from app import config
from app.jd import fetchers
from app.jd.fetchers import PinnedBackend, _default_public_check, is_public_ip


@pytest.mark.parametrize("addr", [
    "127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.0.1", "169.254.169.254", "0.0.0.0", "224.0.0.1",
    "100.64.0.1", "100.127.255.254",              # carrier-grade NAT
    "::1", "fe80::1", "fc00::1", "::",
    "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:169.254.169.254",   # IPv4-mapped
    "64:ff9b::7f00:1", "64:ff9b::a9fe:a9fe", "64:ff9b::c0a8:1",         # NAT64 -> loopback/metadata/private
    "64:ff9b:1::1", "2002:7f00:1::1", "2002:a9fe:a9fe::1", "2001::1",   # local NAT64, 6to4, Teredo
    "::127.0.0.1",                                                      # IPv4-compatible
])
def test_non_public_ips_rejected(addr):
    assert not is_public_ip(ipaddress.ip_address(addr))


@pytest.mark.parametrize("addr", ["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111", "64:ff9b::808:808"])
def test_public_ips_accepted(addr):
    assert is_public_ip(ipaddress.ip_address(addr))


@pytest.mark.parametrize("url", [
    "http://[::ffff:127.0.0.1]/x", "http://[64:ff9b::7f00:1]/x", "http://100.64.0.1/x", "http://169.254.169.254/latest",
    "http://0x7f.1/x", "http://localhost/x",
])
async def test_default_check_blocks_literals_and_tricks(url):
    with pytest.raises(FetchError):
        await _default_public_check(url)


async def test_default_check_rejects_credentials_and_odd_ports(monkeypatch):
    async def fake(host, port):
        return ["93.184.216.34"]
    monkeypatch.setattr(fetchers, "resolve_public", fake)
    with pytest.raises(FetchError, match="Invalid"):
        await _default_public_check("https://user:pw@example.com/")
    with pytest.raises(FetchError, match="ports"):
        await _default_public_check("https://example.com:6379/")
    await _default_public_check("https://example.com/ok")


async def test_hostname_resolving_to_mixed_addresses_is_rejected(monkeypatch):
    async def gai(self, host, port, **kw):
        return [(2, 1, 6, "", ("93.184.216.34", port)), (2, 1, 6, "", ("10.0.0.7", port))]
    import asyncio
    monkeypatch.setattr(asyncio.get_running_loop().__class__, "getaddrinfo", gai)
    with pytest.raises(FetchError, match="private"):
        await fetchers.resolve_public("mixed.example", 443)


async def test_redirect_to_private_address_blocked_on_every_hop():
    checked = []

    async def check(url):
        checked.append(url)
        await _default_public_check(url) if "169.254" in url else None

    def h(req):
        return httpx.Response(302, headers={"location": "http://169.254.169.254/latest/meta-data"})

    with pytest.raises(FetchError, match="private"):
        await fetch_job("https://careers.example.com/job/1", client_for(h), check)
    assert len(checked) == 2 and checked[1].startswith("http://169.254")


class RecordingBackend(httpcore.AsyncNetworkBackend):
    def __init__(self):
        self.dialed = []

    async def connect_tcp(self, host, port, timeout=None, local_address=None, socket_options=None):
        self.dialed.append((host, port))
        raise httpcore.ConnectError("stop")

    async def connect_unix_socket(self, path, timeout=None, socket_options=None):
        raise AssertionError

    async def sleep(self, s):
        pass


async def test_pinned_backend_dials_the_validated_ip_not_the_hostname():
    rec = RecordingBackend()
    answers = iter([["93.184.216.34"], ["127.0.0.1"]])  # a rebinding resolver: public first, then loopback

    async def resolver(host, port):
        return next(answers)

    be = PinnedBackend(rec, resolver)
    with pytest.raises(httpcore.ConnectError):
        await be.connect_tcp("rebind.example", 443)
    assert rec.dialed == [("93.184.216.34", 443)]  # resolved exactly once; the IP literal was dialled


async def test_pinned_backend_refuses_private_resolution():
    rec = RecordingBackend()
    be = PinnedBackend(rec)  # default resolver validates
    with pytest.raises(FetchError):
        await be.connect_tcp("localhost", 80)
    with pytest.raises(FetchError):
        await be.connect_tcp("127.0.0.1", 80)
    assert rec.dialed == []


async def test_pinned_transport_end_to_end_blocks_loopback():
    client = fetchers.make_client()
    async with client:
        with pytest.raises(FetchError):
            await fetchers._get(client, "http://127.0.0.1:80/", lambda u: _noop())


async def _noop():
    return None


def test_default_client_ignores_env_proxy(monkeypatch):
    monkeypatch.setenv("HTTPS_PROXY", "http://proxy.invalid:3128")
    monkeypatch.setattr(config, "FETCH_USE_ENV_PROXY", False)
    c = fetchers.make_client()
    assert c._trust_env is False and not c._mounts


async def test_response_over_byte_cap_is_rejected(monkeypatch):
    monkeypatch.setattr(config, "FETCH_MAX_BYTES", 1000)

    def streaming(req):
        return httpx.Response(200, headers={"content-type": "text/html"}, content=b"<p>" + b"a" * 5000 + b"</p>")

    with pytest.raises(FetchError, match="too large"):
        await fetch_job("https://careers.example.com/job/1", client_for(streaming), _ok)


async def test_chunked_body_without_content_length_is_cut_off(monkeypatch):
    monkeypatch.setattr(config, "FETCH_MAX_BYTES", 1000)
    read = {"n": 0}

    async def body():
        for _ in range(1000):
            read["n"] += 1
            yield b"x" * 100

    def h(req):
        return httpx.Response(200, headers={"content-type": "text/html"}, content=body())

    with pytest.raises(FetchError, match="too large"):
        await fetch_job("https://careers.example.com/job/1", client_for(h), _ok)
    assert read["n"] < 20  # stopped streaming early, did not read 100 kB
