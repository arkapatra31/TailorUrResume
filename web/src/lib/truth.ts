// A browser port of the free-text checks in backend/app/tailor/truth.py (`_unsupported`), simplified for
// the playground: JD terms, "N years" claims, metrics, technologies and mid-sentence proper nouns.
// Header/date and contact checks are left out. Keep the word lists in sync with truth.py and text.py.

const ALIASES: Record<string, string> = {
  js: "javascript", ts: "typescript", k8s: "kubernetes", golang: "go", postgres: "postgresql", nodejs: "node.js",
  node: "node.js", reactjs: "react", "react.js": "react", vuejs: "vue", ml: "machine learning",
  ai: "artificial intelligence", gcp: "google cloud", tf: "terraform", "ci/cd": "cicd", "ci-cd": "cicd",
};
const words = (s: string) => new Set(s.split(/\s+/).filter(Boolean));
const STOP = words(`a an the and or of to in on for with at by from as is are be been this that these those
  you your we our their it its will can must should may have has had using use used experience years year strong
  knowledge ability skills skill working work etc plus including include such than more least well good great
  excellent proven related`);
const TECH = words(`python java javascript typescript go golang rust ruby php swift kotlin scala c++ c# sql nosql
  react angular vue svelte node.js django flask fastapi spring rails laravel docker kubernetes terraform ansible
  jenkins aws azure gcp postgresql mysql mongodb redis kafka rabbitmq spark hadoop airflow snowflake tableau powerbi
  pytorch tensorflow keras pandas numpy graphql grpc elasticsearch kibana grafana prometheus datadog splunk
  salesforce sap jira figma linux git github gitlab bitbucket cicd devops mlops llm nlp`);
const COMMON_CAPS = words(`i i'm i've my the a an and or in on at for with to of by as we our team teams led built
  managed developed designed created implemented delivered improved reduced increased drove january february march
  april may june july august september october november december present dear sincerely regards best thank thanks`);
const COMMON_WORDS = words(`clean code call calls on off review reviews open source test tests testing driven design
  designs pattern patterns practice practices principle principles best quality assurance customer customers success
  service services product products project projects program programs management manager engineering data cloud
  domain event events continuous integration delivery deployment technical debt incident incidents response release
  releases planning performance security user users experience interface full stack front back end cross functional
  remote hybrid agile unit code-review on-call pair programming mentoring mentorship documentation documentations
  architecture system systems software hardware web mobile application applications platform platforms
  infrastructure monitoring observability reliability scalability availability automation pipeline pipelines
  workflow workflows process processes strategy business analytics analysis machine learning model models research
  development operations support sales marketing finance legal compliance stakeholder stakeholders roadmap sprint
  sprints backlog standup api ui ux qa hr kpi okr sla roi saas paas crm erp sdk b2b b2c mvp poc`);
const NUM_WORDS = Object.fromEntries(
  "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty"
    .split(" ").map((w, i) => [w, i]),
) as Record<string, number>;

const TOKEN_RE = /[A-Za-z0-9][A-Za-z0-9+#.]*(?:[-/][A-Za-z0-9+#.]+)*/g;
const WORD_RE = /[A-Za-z][A-Za-z0-9+#.]*(?:[-/][A-Za-z0-9+#.]+)*/g;
const NUM_RE = /\$?\d[\d,]*(?:\.\d+)?/g;
const YEARS_RE = new RegExp(`(?<![\\w.])(\\d{1,2}|${Object.keys(NUM_WORDS).join("|")})\\s*\\+?\\s*(?:-\\s*)?(?:years?|yrs?)\\b`, "gi");
const YEAR_RE = /\b(?:19|20)\d{2}\b/g;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function norm(word: string) {
  let w = word.toLowerCase().replace(/^[.,;:()[\]{}"']+|[.,;:()[\]{}"']+$/g, "");
  w = ALIASES[w] ?? w;
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return w;
}
const tokens = (text: string) => [...text.matchAll(TOKEN_RE)].map((m) => m[0].replace(/\.+$/, ""));
function vocab(text: string) {
  const out = new Set<string>();
  for (const t of tokens(text)) {
    out.add(norm(t));
    for (const p of t.split(/[-/]/)) if (p) out.add(norm(p));
  }
  return out;
}
function termIn(term: string, voc: Set<string>, low: string) {
  const t = term.toLowerCase().trim();
  if (!t) return false;
  if (new RegExp(`(?<![a-z0-9])${esc(t)}(?![a-z0-9])`).test(low)) return true;
  const ws = tokens(t).map(norm).filter((w) => !STOP.has(w));
  if (!ws.length) return false;
  return ws.filter((w) => voc.has(w)).length / ws.length >= (ws.length === 1 ? 1 : 0.7);
}

export interface GuardProfile {
  text: string;            // every profile field, plus approved skills and their evidence
  contact: string[];
  dates: { start: string; end: string }[];
}
export interface Flag { term: string; reason: string; start: number; end: number }

export function checkText(text: string, profile: GuardProfile, jdTerms: string[], now = new Date().getFullYear()): Flag[] {
  const low = profile.text.toLowerCase();
  const voc = vocab(profile.text);
  const nums = new Set([...profile.text.matchAll(NUM_RE)].map((m) => m[0].replace(/,/g, "").replace(/\.$/, "")));
  const extra = new Set<string>();
  for (const c of profile.contact) {
    tokens(c).forEach((t) => extra.add(norm(t)));
    c.split(/[@./:-]+/).filter(Boolean).forEach((p) => extra.add(norm(p)));
  }
  const ys: number[] = [];
  for (const d of profile.dates) {
    const s = (d.start.match(YEAR_RE) ?? []).map(Number);
    if (!s.length) continue;
    const e = (d.end.match(YEAR_RE) ?? []).map(Number);
    ys.push(Math.min(...s), /present|current|now/i.test(d.end) || !d.end.trim() ? now : e.length ? Math.max(...e) : Math.max(...s));
  }
  const span = ys.length >= 2 ? Math.max(...ys) - Math.min(...ys) : 0;
  const claimed = new Set([...profile.text.matchAll(YEARS_RE)].map((m) => (/\d/.test(m[1]) ? +m[1] : NUM_WORDS[m[1].toLowerCase()])));

  const flags: Flag[] = [];
  const seen = new Set<string>();
  const add = (term: string, reason: string, start: number) => {
    if (seen.has(term.toLowerCase())) return;
    seen.add(term.toLowerCase());
    flags.push({ term, reason, start, end: start + term.length });
  };
  const tl = text.toLowerCase();

  // 1. Job-description terms asserted in the text but absent from the profile.
  for (const term of jdTerms) {
    const t = term.trim();
    if (t.length < 2) continue;
    const m = new RegExp(`(?<![a-z0-9])${esc(t.toLowerCase())}(?![a-z0-9])`).exec(tl);
    if (m && !termIn(t, voc, low) && !extra.has(norm(t))) add(text.slice(m.index, m.index + t.length), "Job keyword not in your profile", m.index);
  }
  // 2. "N years": only counts the profile states or its dates span.
  const yearSpans: [number, number][] = [];
  for (const m of text.matchAll(YEARS_RE)) {
    const n = /\d/.test(m[1]) ? +m[1] : NUM_WORDS[m[1].toLowerCase()];
    const i = m.index!;
    yearSpans.push([i, i + m[1].length]);
    if (!(claimed.has(n) || (span > 0 && n <= span))) add(m[0].trim(), `Your dates support ${span} years at most`, i);
  }
  // 3. Metrics that never appear in the profile.
  for (const m of text.matchAll(NUM_RE)) {
    const i = m.index!;
    if (yearSpans.some(([a, b]) => a <= i && i < b)) continue;
    const n = m[0].replace(/,/g, "").replace(/\.$/, "");
    if (n.replace(/^\$/, "") && !nums.has(n.replace(/^\$/, ""))) add(m[0].replace(/\.$/, ""), "Number not in your profile", i);
  }
  // 4. Technologies and mid-sentence proper nouns.
  for (const m of text.matchAll(WORD_RE)) {
    const w = m[0].replace(/\.$/, "");
    const n = norm(w);
    if (voc.has(n) || extra.has(n) || STOP.has(n) || COMMON_CAPS.has(w.toLowerCase()) || w.length < 2) continue;
    const parts = w.split(/[-/]/).filter(Boolean).map(norm);
    const before = text.slice(0, m.index).trimEnd();
    const sentenceStart = !before || ".!?:\n".includes(before[before.length - 1]);
    const isTech = TECH.has(n) || parts.some((p) => TECH.has(p));
    if (!isTech) {
      if (parts.every((p) => COMMON_WORDS.has(p) || STOP.has(p) || voc.has(p) || extra.has(p) || p.length < 2)) continue;
      if (COMMON_WORDS.has(n)) continue;
    }
    const shaped = (/[A-Z].*[A-Z]/.test(w) || /[+#]/.test(w) || (/\d/.test(w) && /[A-Za-z]/.test(w))) && w.length >= 2;
    const allCaps = /^[A-Za-z]+$/.test(w) && w === w.toUpperCase() && w.length >= 3;
    const capitalised = /^[A-Z]/.test(w) && !sentenceStart;
    if ((isTech || capitalised || shaped || allCaps) && (isTech || !parts.some((p) => p.length > 2 && voc.has(p)))) {
      add(w, isTech ? "Technology not in your profile" : "Name not in your profile", m.index!);
    }
  }
  // Drop flags nested inside another one ("Gen" inside "Gen AI") so highlights never overlap.
  flags.sort((a, b) => a.start - b.start || b.end - a.end);
  return flags.filter((f, i) => !flags.slice(0, i).some((g) => g.start <= f.start && f.end <= g.end));
}
