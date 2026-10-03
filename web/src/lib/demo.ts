// Demo data shared by the interactive sections. Same fictional candidate and job as the product
// screenshots (frontend/e2e/screenshots.spec.ts), so every part of the page tells one story.
import type { GuardProfile } from "./truth";

export const PROFILE = {
  name: "Jordan Rivera",
  contact: ["jordan@example.com", "+1 555 0142", "Austin, TX", "github.com/jordanrivera"],
  summary: "ML engineer who ships LLM apps and the data services behind them.",
  experience: [
    {
      title: "ML Engineer", company: "Brightline Analytics", location: "Austin, TX", start: "2021", end: "Present",
      bullets: [
        "Built LLM apps with LangChain and the Claude SDK used by 3 internal teams.",
        "Designed FastAPI services for document parsing and retrieval (RAG).",
        "Cut model-serving latency by 35% by batching requests and caching embeddings.",
      ],
    },
    {
      title: "Data Engineer", company: "Harbor Logistics", location: "Remote", start: "2018", end: "2021",
      bullets: [
        "Built Python ETL pipelines processing 2M shipment records per day.",
        "Migrated reporting to PostgreSQL and containerised jobs with Docker.",
      ],
    },
  ],
  education: [{ school: "Lakeside University", degree: "BSc", field: "Computer Science", start: "2014", end: "2018" }],
  skills: ["Python", "LangChain", "Claude SDK", "FastAPI", "RAG", "PostgreSQL", "Docker", "Pandas"],
};

export const JD = {
  title: "Senior ML Engineer",
  company: "Northwind Labs",
  must_have: ["Python", "Gen AI", "SQL"],
  nice_to_have: ["Kubernetes", "Rust"],
  keywords: ["Python", "Gen AI", "SQL", "LangChain", "FastAPI", "RAG", "Kubernetes", "Rust"],
};

/** Skills approved on the Match step, with the evidence that backs them. */
export const ATTESTED = [
  { skill: "Gen AI", evidence: "LangChain, Claude SDK" },
  { skill: "SQL", evidence: "PostgreSQL" },
];

/** The profile as the truth guard sees it; approved skills and their evidence count as profile facts. */
export const guardProfile = (withApproved: boolean): GuardProfile => ({
  text: [
    PROFILE.summary, PROFILE.name,
    ...PROFILE.experience.flatMap((e) => [e.company, e.title, e.location, e.start, e.end, ...e.bullets]),
    ...PROFILE.education.flatMap((e) => [e.school, e.degree, e.field, e.start, e.end]),
    ...PROFILE.skills,
    ...(withApproved ? ATTESTED.flatMap((a) => [a.skill, a.evidence]) : []),
  ].join("\n"),
  contact: [PROFILE.name, ...PROFILE.contact],
  dates: PROFILE.experience.map(({ start, end }) => ({ start, end })),
});
export const JD_TERMS = [...JD.must_have, ...JD.nice_to_have, ...JD.keywords];

export const MATCHED = ["Python", "LangChain", "FastAPI", "RAG"];
// Keyword coverage 43 + semantic fit 82, blended 55/45 -> 61. With Gen AI + SQL approved the app previews 83.
export const SCORE = { before: 61, after: 83, keyword: 86, semantic: 82 };

export type Verdict = "supported" | "partial" | "unsupported";

export interface BridgeCase {
  skill: string;
  /** What the model claimed, before grounding. */
  claimed: { verdict: Verdict; evidence: string[] };
  /** What survives grounding: evidence must literally appear in the profile. */
  verdict: Verdict;
  evidence: string[];
  rationale: string;
  /** Profile line that holds the evidence (highlighted). */
  source?: string;
  outcome: { before?: string; after?: string; note: string };
}

export const BRIDGE: BridgeCase[] = [
  {
    skill: "Gen AI",
    claimed: { verdict: "supported", evidence: ["LangChain", "Claude SDK"] },
    verdict: "supported", evidence: ["LangChain", "Claude SDK"],
    rationale: "LLM apps built with LangChain and the Claude SDK are Gen AI work.",
    source: PROFILE.experience[0].bullets[0],
    outcome: {
      before: "Built LLM apps with LangChain and the Claude SDK used by 3 internal teams.",
      after: "Built Gen AI apps with LangChain and the Claude SDK used by 3 internal teams.",
      note: "Claimable. Worked in by rephrasing your own wording. No new bullets, no new achievements.",
    },
  },
  {
    skill: "SQL",
    claimed: { verdict: "supported", evidence: ["PostgreSQL"] },
    verdict: "supported", evidence: ["PostgreSQL"],
    rationale: "PostgreSQL work genuinely demonstrates SQL.",
    source: PROFILE.experience[1].bullets[1],
    outcome: {
      before: "Migrated reporting to PostgreSQL and containerised jobs with Docker.",
      after: "Migrated reporting to PostgreSQL (SQL) and containerised jobs with Docker.",
      note: "Claimable. Named next to the technology that proves it.",
    },
  },
  {
    skill: "Kubernetes",
    claimed: { verdict: "partial", evidence: ["Docker"] },
    verdict: "partial", evidence: ["Docker"],
    rationale: "Docker is related container work, but it is not Kubernetes.",
    source: PROFILE.experience[1].bullets[1],
    outcome: { note: "Partial. Your Docker work may be mentioned as related experience, but Kubernetes itself is never claimed." },
  },
  {
    skill: "Rust",
    claimed: { verdict: "unsupported", evidence: [] },
    verdict: "unsupported", evidence: [],
    rationale: "Nothing in the profile points to Rust.",
    outcome: { note: "Unsupported. It goes on the do-not-claim list, and the truth guard flags it if it slips in." },
  },
  {
    skill: "AWS",
    claimed: { verdict: "supported", evidence: ["Lambda", "S3"] },
    verdict: "unsupported", evidence: [],
    rationale: "The model cited Lambda and S3, but neither appears anywhere in the profile.",
    outcome: { note: "The model overclaimed. Its evidence was not in your profile, so grounding collapsed the verdict to unsupported." },
  },
];
