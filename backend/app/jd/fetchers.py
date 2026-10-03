"""Job posting fetchers: LinkedIn (guest endpoint), Greenhouse, Lever, generic.

Fetching happens only on explicit user action, one URL at a time. Nothing is cached.
Note: scraping LinkedIn may violate its Terms of Service; see the README.
"""
from __future__ import annotations

import asyncio
import html
import ipaddress
import json
import re
import socket
import ssl
from dataclasses import dataclass, asdict
from typing import Awaitable, Callable, Optional
from urllib.parse import parse_qs, urlparse

import httpcore
import httpx
from bs4 import BeautifulSoup

from .. import config

UA = "Mozilla/5.0 (compatible; TailorUrResume/1.0; +user-initiated-fetch)"


class FetchError(Exception):
    pass


@dataclass
class FetchedJob:
    source: str
    url: str
    text: str
    title: str = ""
    company: str = ""
    location: str = ""

    def dict(self) -> dict:
        return asdict(self)


# ---------- URL parsing ----------
def linkedin_job_id(url: str) -> Optional[str]:
    p = urlparse(url)
    if "linkedin.com" not in (p.hostname or ""):
        return None
    m = re.search(r"/jobs/view/(?:[^/?#]*-)?(\d{5,})", p.path)
    if m:
        return m.group(1)
    q = parse_qs(p.query)
    for k in ("currentJobId", "jobId"):
        if k in q and q[k][0].isdigit():
            return q[k][0]
    m = re.search(r"/jobPosting/(\d{5,})", p.path)
    return m.group(1) if m else None


def greenhouse_ids(url: str) -> Optional[tuple[str, str]]:
    p = urlparse(url)
    if not (p.hostname or "").endswith("greenhouse.io"):
        return None
    m = re.search(r"^/(?:embed/job_app)?/?([^/]+)/jobs/(\d+)", p.path)
    if m:
        return m.group(1), m.group(2)
    q = parse_qs(p.query)
    if "for" in q and "token" in q:
        return q["for"][0], q["token"][0]
    return None


def lever_ids(url: str) -> Optional[tuple[str, str]]:
    p = urlparse(url)
    if (p.hostname or "") != "jobs.lever.co":
        return None
    parts = [x for x in p.path.split("/") if x]
    if len(parts) >= 2:
        return parts[0], parts[1]
    return None


# ---------- helpers ----------
def html_to_text(markup: str) -> str:
    soup = BeautifulSoup(markup, "html.parser")
    for br in soup.find_all("br"):
        br.replace_with("\n")
    for li in soup.find_all("li"):
        li.insert_before("\n- ")
    for blk in soup.find_all(["p", "div", "h1", "h2", "h3", "h4", "ul", "ol", "section"]):
        blk.append("\n")
    return clean_text(soup.get_text())


def clean_text(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ---------- SSRF guard ----------
_V4 = ipaddress.IPv4Address
_NAT64 = ipaddress.ip_network("64:ff9b::/96")
_NAT64_LOCAL = ipaddress.ip_network("64:ff9b:1::/48")
_SIX_TO_FOUR = ipaddress.ip_network("2002::/16")
_V4_COMPAT = ipaddress.ip_network("::/96")
_TEREDO = ipaddress.ip_network("2001::/32")
_CGNAT = ipaddress.ip_network("100.64.0.0/10")
ALLOWED_PORTS = {80, 443}


def unwrap_ip(ip):
    """Return the IPv4 address embedded in IPv4-mapped, NAT64, 6to4 and IPv4-compatible IPv6 forms."""
    if ip.version == 6:
        if ip.ipv4_mapped:
            return ip.ipv4_mapped
        if ip in _NAT64 or ip in _V4_COMPAT:
            return _V4(int(ip) & 0xFFFFFFFF)
        if ip in _SIX_TO_FOUR:
            return _V4((int(ip) >> 80) & 0xFFFFFFFF)
    return ip


def is_public_ip(ip) -> bool:
    """True only for globally routable unicast addresses (after unwrapping embedded IPv4)."""
    if ip.version == 6 and (ip in _NAT64_LOCAL or ip in _TEREDO):
        return False
    ip = unwrap_ip(ip)
    if ip.version == 4 and ip in _CGNAT:
        return False
    return ip.is_global and not ip.is_multicast and not ip.is_unspecified


async def resolve_public(host: str, port: int = 443) -> list[str]:
    """Resolve host and return its addresses, raising FetchError unless EVERY address is public."""
    try:
        literal = ipaddress.ip_address(host.strip("[]"))
        infos = [(None, None, None, None, (str(literal), port))]
    except ValueError:
        try:
            infos = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
        except (socket.gaierror, UnicodeError):
            raise FetchError("Could not resolve that host.") from None
    ips: list[str] = []
    for info in infos:
        addr = info[4][0].split("%")[0]
        if not is_public_ip(ipaddress.ip_address(addr)):
            raise FetchError("Refusing to fetch private or local addresses.")
        ips.append(addr)
    if not ips:
        raise FetchError("Could not resolve that host.")
    return ips


async def _default_public_check(url: str) -> None:
    u = urlparse(url)
    if not u.hostname or u.username or u.password:
        raise FetchError("Invalid URL.")
    try:
        port = u.port or (443 if u.scheme == "https" else 80)
    except ValueError:
        raise FetchError("Invalid URL.") from None
    await resolve_public(u.hostname, port)
    if port not in ALLOWED_PORTS:
        raise FetchError("Only standard web ports (80/443) can be fetched.")


class PinnedBackend(httpcore.AsyncNetworkBackend):
    """Network backend that resolves, validates and connects in ONE step.

    httpcore calls connect_tcp(host, port) with the URL's host; we resolve that host ourselves,
    reject non-public addresses and dial the validated IP literal. TLS SNI and certificate checks
    still use the original hostname, and a second DNS lookup (DNS rebinding) can never happen.
    """

    def __init__(self, inner: Optional[httpcore.AsyncNetworkBackend] = None, resolver=resolve_public):
        self._inner = inner or httpcore.AnyIOBackend()
        self._resolve = resolver

    async def connect_tcp(self, host, port, timeout=None, local_address=None, socket_options=None):
        ips = await self._resolve(host, port)
        last: Optional[Exception] = None
        for ip in ips:
            try:
                return await self._inner.connect_tcp(ip, port, timeout=timeout, local_address=local_address,
                                                     socket_options=socket_options)
            except Exception as e:  # noqa: BLE001 - try the next validated address
                last = e
        raise last or httpcore.ConnectError("no address")

    async def connect_unix_socket(self, path, timeout=None, socket_options=None):
        raise httpcore.ConnectError("unix sockets are not allowed")

    async def sleep(self, seconds):
        await self._inner.sleep(seconds)


def make_pinned_transport(backend: Optional[httpcore.AsyncNetworkBackend] = None) -> httpx.AsyncHTTPTransport:
    t = httpx.AsyncHTTPTransport(retries=0)
    t._pool = httpcore.AsyncConnectionPool(
        ssl_context=ssl.create_default_context(), max_connections=10, network_backend=backend or PinnedBackend(),
    )
    return t


def make_client() -> httpx.AsyncClient:
    """Production client: pinned connections, no env proxies (a proxy would resolve the name itself).

    Set FETCH_USE_ENV_PROXY=1 only where egress REQUIRES an HTTP proxy. Every hop is then still
    validated by the pre-flight check, but connections cannot be pinned to the validated IP.
    """
    timeout = httpx.Timeout(config.FETCH_TIMEOUT)
    if config.FETCH_USE_ENV_PROXY:
        return httpx.AsyncClient(timeout=timeout, trust_env=True)
    return httpx.AsyncClient(timeout=timeout, trust_env=False, transport=make_pinned_transport())


PublicCheck = Callable[[str], Awaitable[None]]


async def _read_capped(r: httpx.Response, cap: int) -> bytes:
    declared = r.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > cap:
        raise FetchError("That page is too large to import.")
    buf = bytearray()
    async for chunk in r.aiter_bytes():
        buf += chunk
        if len(buf) > cap:
            raise FetchError("That page is too large to import.")
    return bytes(buf)


async def _get(
    client: httpx.AsyncClient, url: str, check: PublicCheck, accept: str = "text/html,*/*"
) -> httpx.Response:
    cap = config.FETCH_MAX_BYTES
    for _ in range(5):
        if not url.startswith(("http://", "https://")):
            raise FetchError("Only http(s) URLs are supported.")
        await check(url)  # validate EVERY hop, including redirects
        req = client.build_request("GET", url, headers={"User-Agent": UA, "Accept": accept})
        try:
            r = await client.send(req, stream=True, follow_redirects=False)
        except httpx.HTTPError:
            raise FetchError("Network error while fetching the page.") from None
        try:
            if r.is_redirect and r.headers.get("location"):
                url = str(httpx.URL(url).join(r.headers["location"]))
                continue
            if r.status_code in (403, 429, 999):
                raise FetchError(f"The site refused the request (HTTP {r.status_code}); it may be blocking automated access.")
            if r.status_code == 404:
                raise FetchError("Posting not found (it may have been closed).")
            if r.status_code >= 400:
                raise FetchError(f"The site returned HTTP {r.status_code}.")
            try:
                body = await _read_capped(r, cap)
            except httpx.HTTPError:
                raise FetchError("Network error while fetching the page.") from None
            headers = [(k, v) for k, v in r.headers.multi_items() if k.lower() not in ("content-encoding", "content-length")]
            return httpx.Response(r.status_code, headers=headers, content=body, request=req)
        finally:
            await r.aclose()
    raise FetchError("Too many redirects.")


# ---------- individual fetchers ----------
async def fetch_linkedin(job_id: str, client, check) -> FetchedJob:
    r = await _get(client, f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}", check)
    soup = BeautifulSoup(r.text, "html.parser")

    def txt(*selectors: str) -> str:
        for s in selectors:
            el = soup.select_one(s)
            if el and el.get_text(strip=True):
                return el.get_text(" ", strip=True)
        return ""

    title = txt(".top-card-layout__title", ".topcard__title", "h2", "h1")
    company = txt(".topcard__org-name-link", ".top-card-layout__card a.topcard__org-name-link", ".topcard__flavor")
    location = txt(".topcard__flavor--bullet", ".top-card__flavor--bullet")
    body_el = soup.select_one(".show-more-less-html__markup") or soup.select_one(".description__text")
    if not body_el:
        raise FetchError("LinkedIn returned no job description (the posting may require login).")
    body = html_to_text(str(body_el))
    header = "\n".join(x for x in (title, company, location) if x)
    return FetchedJob(
        "linkedin",
        f"https://www.linkedin.com/jobs/view/{job_id}",
        (header + "\n\n" + body).strip(),
        title, company, location,
    )


async def fetch_greenhouse(board: str, job_id: str, client, check) -> FetchedJob:
    r = await _get(client, f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{job_id}", check, "application/json")
    try:
        d = r.json()
    except ValueError:
        raise FetchError("Unexpected response from Greenhouse.") from None
    content = html.unescape(d.get("content", ""))
    body = html_to_text(content)
    title = d.get("title", "")
    company = d.get("company_name") or board.replace("-", " ").title()
    location = (d.get("location") or {}).get("name", "")
    if not body:
        raise FetchError("Greenhouse posting had no content.")
    text = "\n".join(x for x in (title, company, location) if x) + "\n\n" + body
    return FetchedJob("greenhouse", d.get("absolute_url", ""), text, title, company, location)


async def fetch_lever(company: str, job_id: str, client, check) -> FetchedJob:
    r = await _get(client, f"https://api.lever.co/v0/postings/{company}/{job_id}", check, "application/json")
    try:
        d = r.json()
    except ValueError:
        raise FetchError("Unexpected response from Lever.") from None
    parts = [d.get("descriptionPlain") or html_to_text(d.get("description", ""))]
    for lst in d.get("lists", []) or []:
        parts.append(f"{lst.get('text', '')}\n{html_to_text(lst.get('content', ''))}")
    parts.append(d.get("additionalPlain") or html_to_text(d.get("additional", "")))
    title = d.get("text", "")
    location = (d.get("categories") or {}).get("location", "")
    comp = company.replace("-", " ").title()
    text = "\n".join(x for x in (title, comp, location) if x) + "\n\n" + "\n\n".join(p for p in parts if p)
    return FetchedJob("lever", d.get("hostedUrl", ""), clean_text(text), title, comp, location)


async def fetch_generic(url: str, client, check) -> FetchedJob:
    r = await _get(client, url, check)
    ctype = r.headers.get("content-type", "")
    if "html" not in ctype and "<html" not in r.text[:500].lower():
        raise FetchError("That URL did not return a web page.")
    soup = BeautifulSoup(r.text, "html.parser")
    title = company = location = ""
    # Prefer schema.org JobPosting when present.
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except ValueError:
            continue
        for obj in data if isinstance(data, list) else [data]:
            if isinstance(obj, dict) and obj.get("@type") == "JobPosting":
                title = obj.get("title", "")
                org = obj.get("hiringOrganization") or {}
                company = org.get("name", "") if isinstance(org, dict) else ""
                body = html_to_text(html.unescape(obj.get("description", "")))
                if len(body) > 200:
                    text = "\n".join(x for x in (title, company) if x) + "\n\n" + body
                    return FetchedJob("generic", url, text, title, company, "")
    for t in soup(["script", "style", "noscript", "nav", "header", "footer", "aside", "form", "svg", "iframe"]):
        t.decompose()
    root = soup.find("main") or soup.find("article") or soup.body or soup
    text = html_to_text(str(root))
    h1 = soup.find("h1")
    title = h1.get_text(" ", strip=True) if h1 else (soup.title.string.strip() if soup.title and soup.title.string else "")
    if len(text) < 120:
        raise FetchError("Could not find readable job text on that page (it may be rendered by JavaScript).")
    return FetchedJob("generic", url, text[: config.MAX_TEXT_CHARS], title, "", "")


async def fetch_job(
    url: str,
    client: Optional[httpx.AsyncClient] = None,
    public_check: PublicCheck = _default_public_check,
) -> FetchedJob:
    url = url.strip()
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    own = client is None
    client = client or make_client()
    try:
        if (jid := linkedin_job_id(url)):
            return await fetch_linkedin(jid, client, public_check)
        if (gh := greenhouse_ids(url)):
            return await fetch_greenhouse(*gh, client, public_check)
        if (lv := lever_ids(url)):
            return await fetch_lever(*lv, client, public_check)
        if "linkedin.com" in (urlparse(url).hostname or ""):
            raise FetchError("Could not find a job id in that LinkedIn URL (expected /jobs/view/<id> or currentJobId=<id>).")
        return await fetch_generic(url, client, public_check)
    finally:
        if own:
            await client.aclose()
