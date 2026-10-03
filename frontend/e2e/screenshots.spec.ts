/**
 * Product screenshots for the landing page (web/). Skipped unless SHOTS_DIR is set:
 *   SHOTS_DIR=../web/public/shots npx playwright test screenshots
 * Drives the real UI against a mocked API with demo data, one run per theme, and writes WebP files.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type Page } from "@playwright/test";
import { press } from "./mocks";

const OUT = process.env.SHOTS_DIR;

const profile = {
  contact: { name: "Jordan Rivera", email: "jordan@example.com", phone: "+1 555 0142", location: "Austin, TX", links: ["github.com/jordanrivera"] },
  summary: "ML engineer who ships LLM apps and the data services behind them.",
  experience: [
    { company: "Brightline Analytics", title: "ML Engineer", location: "Austin, TX", start: "2021", end: "Present", bullets: [
      "Built LLM apps with LangChain and the Claude SDK used by 3 internal teams.",
      "Designed FastAPI services for document parsing and retrieval (RAG).",
      "Cut model-serving latency by 35% by batching requests and caching embeddings.",
    ] },
    { company: "Harbor Logistics", title: "Data Engineer", location: "Remote", start: "2018", end: "2021", bullets: [
      "Built Python ETL pipelines processing 2M shipment records per day.",
      "Migrated reporting to PostgreSQL and containerised jobs with Docker.",
    ] },
  ],
  projects: [],
  education: [{ school: "Lakeside University", degree: "BSc", field: "Computer Science", start: "2014", end: "2018", details: [] }],
  skills: ["Python", "LangChain", "Claude SDK", "FastAPI", "RAG", "PostgreSQL", "Docker", "Pandas"],
  certifications: [], publications: [],
};

const jd = {
  title: "Senior ML Engineer", company: "Northwind Labs", location: "Remote (US)", seniority: "Senior",
  summary: "Build and ship Gen AI features end to end.",
  must_have: ["Python", "Gen AI", "SQL"], nice_to_have: ["Kubernetes", "Rust"],
  responsibilities: ["Ship LLM-powered product features", "Own retrieval and evaluation pipelines", "Operate services in production"],
  keywords: ["Python", "Gen AI", "SQL", "LangChain", "FastAPI", "RAG", "Kubernetes", "Rust"], source_url: "",
};

// Keywords 6/14 weighted = 43; 0.55 * 43 + 0.45 * 82 = 61. Adding Gen AI + SQL previews 84.
const match = {
  score: 61, keyword_score: 43, semantic_score: 82,
  matched: ["Python", "LangChain", "FastAPI", "RAG"], missing: ["Gen AI", "SQL", "Kubernetes", "Rust"],
  strengths: ["Hands-on LLM app work with LangChain and the Claude SDK", "Production FastAPI and retrieval services"],
  gaps: ["Gen AI is not named explicitly", "No Kubernetes experience listed"],
  suggestions: ["Lead with the LLM apps and their adoption", "Name the SQL work behind the PostgreSQL migration"],
};

const bridge = {
  items: [
    { skill: "Gen AI", verdict: "supported", evidence: ["LangChain", "Claude SDK"], rationale: "Built LLM apps with LangChain and the Claude SDK." },
    { skill: "SQL", verdict: "supported", evidence: ["PostgreSQL"], rationale: "Migrated reporting to PostgreSQL." },
    { skill: "Kubernetes", verdict: "partial", evidence: ["Docker"], rationale: "Containerised jobs with Docker; orchestration is transferable, not shown." },
    { skill: "Rust", verdict: "unsupported", evidence: [], rationale: "No Rust experience in the profile." },
  ],
};

const doc = {
  kind: "resume", name: "Jordan Rivera", contact: ["jordan@example.com", "+1 555 0142", "Austin, TX", "github.com/jordanrivera"],
  sections: [
    { title: "Summary", items: [], paragraphs: [
      "ML engineer who ships Gen AI apps with LangChain and the Claude SDK, and the FastAPI, retrieval and SQL services behind them.",
    ] },
    { title: "Experience", paragraphs: [], items: [
      { heading: "ML Engineer", subheading: "Brightline Analytics", dates: "2021 - Present", note: "Austin, TX", bullets: [
        "Built Gen AI apps with LangChain and the Claude SDK used by 3 internal teams.",
        "Designed FastAPI services for document parsing and retrieval (RAG).",
        "Cut model-serving latency by 35% by batching requests and caching embeddings.",
      ] },
      { heading: "Data Engineer", subheading: "Harbor Logistics", dates: "2018 - 2021", note: "Remote", bullets: [
        "Built Python ETL pipelines processing 2M shipment records per day.",
        "Migrated reporting to PostgreSQL (SQL) and containerised jobs with Docker.",
      ] },
    ] },
    { title: "Skills", items: [], paragraphs: ["Python, Gen AI (LangChain, Claude SDK), RAG, FastAPI, SQL (PostgreSQL), Docker, Pandas"] },
    { title: "Education", paragraphs: [], items: [
      { heading: "BSc, Computer Science", subheading: "Lakeside University", dates: "2014 - 2018", note: "", bullets: [] },
    ] },
  ],
};

const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

async function mock(page: Page) {
  await page.route("**/api/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/api/test-connection") return route.fulfill(json({ ok: true, provider: "anthropic", model: "claude" }));
    if (p === "/api/profile/parse") return route.fulfill(json(profile));
    if (p === "/api/jd/extract") return route.fulfill(json(jd));
    if (p === "/api/match") return route.fulfill(json(match));
    if (p === "/api/bridge") return route.fulfill(json(bridge));
    if (p === "/api/generate") {
      return route.fulfill({ status: 200, contentType: "text/event-stream",
        body: sse("token", { text: "# Jordan Rivera\n\n## Summary\n" }) + sse("done", { doc, flags: [] }) });
    }
    if (p === "/api/check-truth") return route.fulfill(json({ flags: [] }));
    return route.fulfill(json({}));
  });
}

/** Screenshot the viewport and save it as WebP (encoded by the browser; no image tooling needed). */
async function shot(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(0, 0);
  await page.waitForTimeout(900);
  const png = (await page.screenshot()).toString("base64");
  const enc = await page.context().newPage();
  const webp = await enc.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height });
    c.getContext("2d")!.drawImage(img, 0, 0);
    return c.toDataURL("image/webp", 0.86).split(",")[1];
  }, png);
  await enc.close();
  await writeFile(path.join(OUT!, `${name}.webp`), Buffer.from(webp, "base64"));
}

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });

for (const theme of ["dark", "light"] as const) {
  test(`landing page screenshots (${theme})`, async ({ page }) => {
    test.skip(!OUT, "set SHOTS_DIR to write screenshots");
    await mkdir(OUT!, { recursive: true });
    await mock(page);
    await page.goto("/");
    if (await page.evaluate(() => document.documentElement.dataset.theme) !== theme) {
      await page.getByRole("button", { name: "Toggle color theme" }).click();
    }
    // Toasts would cover part of the shot.
    await page.addStyleTag({ content: "[data-sonner-toaster] { display: none !important; }" });

    await page.getByLabel("API key").fill("sk-ant-demo-key-not-real");
    await shot(page, `key-${theme}`);
    await press(page, /Continue/);

    await page.locator('input[type="file"]').setInputFiles({ name: "jordan-rivera.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await page.getByText("Parsed from").waitFor();
    await shot(page, `profile-${theme}`);
    await press(page, /Continue/);

    await press(page, /Add a job/);
    await page.getByLabel("Job description").fill("Senior ML Engineer at Northwind Labs. Python, Gen AI and SQL required; Kubernetes and Rust a plus.");
    await press(page, /Extract details/);
    await page.getByRole("button", { name: /Re-extract details/ }).waitFor();
    await shot(page, `job-${theme}`);
    await press(page, /Analyze match/);

    await page.getByText("Semantic fit", { exact: true }).waitFor();
    await page.getByRole("button", { name: /Bridge gaps/ }).click();
    await page.getByRole("button", { name: /Include all supported/ }).click();
    await page.getByText(/Preview with 2 added skill/).waitFor();
    await shot(page, `match-${theme}`);
    await press(page, /Craft documents/);

    await press(page, /Generate Resume/);
    await page.locator("#main").getByText("Every claim traces back to your profile.").waitFor();
    await shot(page, `craft-${theme}`);
    await press(page, /^Export/);

    await page.getByRole("heading", { level: 1, name: /Ship it/ }).waitFor();
    await shot(page, `export-${theme}`);
  });
}
