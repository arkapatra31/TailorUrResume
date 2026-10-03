import type { Page } from "@playwright/test";

export const profile = {
  contact: { name: "Ada Lovelace", email: "ada@example.com", phone: "+1 555 0100", location: "London, UK", links: ["github.com/ada"] },
  summary: "Engineer who builds analytical engines and reliable data pipelines.",
  experience: [{
    company: "Analytical Engines Ltd", title: "Software Engineer", location: "London", start: "2019", end: "Present",
    bullets: ["Built a Python data pipeline processing 2M records per day.", "Led a team of 4 engineers on a migration to PostgreSQL."],
  }],
  projects: [],
  education: [{ school: "University of London", degree: "BSc", field: "Mathematics", start: "2014", end: "2018", details: [] }],
  skills: ["Python", "PostgreSQL", "Docker", "React"],
  certifications: [], publications: [],
};

export const jd = {
  title: "Backend Engineer", company: "Acme Corp", location: "Remote", seniority: "Mid",
  summary: "Build APIs.", must_have: ["Python", "PostgreSQL"], nice_to_have: ["Docker", "Kubernetes"],
  responsibilities: ["Design APIs", "Operate services"], keywords: ["Python", "PostgreSQL", "Docker", "Kubernetes", "Go"], source_url: "",
};

export const match = {
  score: 72, keyword_score: 70, semantic_score: 74,
  matched: ["Python", "PostgreSQL", "Docker"], missing: ["Kubernetes", "Go"],
  strengths: ["Strong Python background"], gaps: ["No Kubernetes experience listed"], suggestions: ["Highlight data pipeline scale"],
};

export const doc = {
  kind: "resume", name: "Ada Lovelace", contact: ["ada@example.com", "London, UK"],
  sections: [
    { title: "Summary", paragraphs: ["Engineer who builds reliable data pipelines."], items: [] },
    { title: "Experience", paragraphs: [], items: [{
      heading: "Software Engineer", subheading: "Analytical Engines Ltd", dates: "2019 - Present", note: "",
      bullets: ["Built a Python data pipeline processing 2M records per day.", "Led a team of 4 engineers on a migration to PostgreSQL."],
    }] },
    { title: "Skills", paragraphs: ["Python, PostgreSQL, Docker, React"], items: [] },
  ],
};

/** Bridge verdicts for `match.missing`: Kubernetes is backed by Docker work, Go has no support at all. */
export const bridge = {
  items: [
    { skill: "Kubernetes", verdict: "supported", evidence: ["Docker"], rationale: "Containerised services with Docker." },
    { skill: "Go", verdict: "unsupported", evidence: [], rationale: "No Go experience in the profile." },
  ],
};

const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const sseEvent = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

type Flag = { text: string; section: number; item: number; bullet: number; unsupported: string[]; reason: string; level?: "warn" | "info" };
type Body = any;

export interface MockOptions {
  matchFails?: number;
  match?: typeof match;
  bridge?: typeof bridge;
  /** SSE `bridge` event to emit when the generate request has `auto_bridge: true`. */
  autoBridge?: { items: typeof bridge.items; added: { skill: string; evidence: string; self_attested: boolean }[] };
  flags?: Flag[];
}

/** Mock the whole backend API. Returns counters and request bodies so tests can assert on calls. */
export async function mockApi(page: Page, opts: MockOptions = {}) {
  const calls = { match: 0, headers: [] as Record<string, string>[], bodies: {} as Record<string, Body[]> };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const h = route.request().headers();
    calls.headers.push(h);
    let body: Body = null;
    try { body = route.request().postDataJSON(); } catch { /* multipart or empty */ }
    (calls.bodies[p] ??= []).push(body);
    if (p === "/api/test-connection") return route.fulfill(json({ ok: true, provider: "anthropic", model: "m" }));
    if (p === "/api/profile/parse") return route.fulfill(json(profile));
    if (p === "/api/jd/extract") return route.fulfill(json(jd));
    if (p === "/api/match") {
      calls.match += 1;
      if (calls.match <= (opts.matchFails ?? 0)) return route.fulfill(json({ detail: "Model overloaded." }, 502));
      return route.fulfill(json(opts.match ?? match));
    }
    if (p === "/api/bridge") return route.fulfill(json(opts.bridge ?? bridge));
    if (p === "/api/generate") {
      const sse =
        (body?.auto_bridge && opts.autoBridge ? sseEvent("bridge", opts.autoBridge) : "") +
        sseEvent("token", { text: "# Ada Lovelace\n\n## Summary\n" }) +
        sseEvent("token", { text: "Engineer who builds reliable data pipelines.\n" }) +
        sseEvent("done", { doc, flags: opts.flags ?? [] });
      return route.fulfill({ status: 200, contentType: "text/event-stream", body: sse });
    }
    if (p === "/api/check-truth") return route.fulfill(json({ flags: [] }));
    if (p === "/api/regenerate-bullet") return route.fulfill(json({ bullet: "Rebuilt the pipeline in Python.", unsupported: [] }));
    if (p.startsWith("/api/export/")) return route.fulfill({ status: 200, contentType: "application/octet-stream", body: "x" });
    return route.fulfill(json({ detail: "not mocked" }, 404));
  });
  return calls;
}

export async function dumpStorage(page: Page) {
  return page.evaluate(async () => {
    const dbs = (indexedDB as unknown as { databases?: () => Promise<unknown[]> }).databases;
    return {
      local: localStorage.length, session: sessionStorage.length, cookies: document.cookie,
      idb: dbs ? (await dbs.call(indexedDB)).length : 0,
    };
  });
}

/** Click a button once the previous step has finished its exit animation (only one match left in <main>). */
export async function press(page: Page, name: RegExp) {
  const b = page.getByRole("button", { name });
  await b.first().waitFor();
  await page.waitForFunction((n) => document.querySelectorAll("main button").length > 0 && [...document.querySelectorAll("main button")].filter((x) => new RegExp(n).test(x.textContent ?? "")).length === 1, name.source);
  await b.click();
}

/** Drive the UI through Key -> Profile -> Job -> Match and wait for the analysis to render. */
export async function reachMatch(page: Page) {
  await page.goto("/");
  await page.getByLabel("API key").fill("sk-ant-test-key");
  await press(page, /Continue/);
  await page.locator('input[type="file"]').setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 fake") });
  await page.getByText("Parsed from").waitFor();
  await press(page, /Continue/);
  await press(page, /Add a job/);
  await page.getByLabel("Job description").fill("We need a Backend Engineer with Python and PostgreSQL experience. Docker is a plus.");
  await press(page, /Extract details/);
  await press(page, /Analyze match/);
  await page.getByText("Semantic fit", { exact: true }).waitFor();
}

/** Drive the UI through Key -> Profile -> Job -> Match -> Craft and generate a resume. */
export async function reachCraft(page: Page) {
  await reachMatch(page);
  await press(page, /Craft documents/);
  await press(page, /Generate Resume/);
  await page.locator("#main").getByText("Analytical Engines Ltd").first().waitFor();
}
