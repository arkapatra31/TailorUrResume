import { z } from "zod";
import { toast } from "sonner";
import { buildSession, useStore, type SessionFile } from "@/store";
import { downloadBlob, uid } from "./utils";

const str = z.string().nullish().transform((v) => v ?? "");
const strs = z.array(z.string().nullable().transform((v) => v ?? "")).nullish().transform((v) => v ?? []);
const num = (d = 0) => z.number().nullish().transform((v) => v ?? d);

const contact = z.object({ name: str, email: str, phone: str, location: str, links: strs }).nullish().transform((v) => v ?? { name: "", email: "", phone: "", location: "", links: [] as string[] });
const experience = z.object({ company: str, title: str, location: str, start: str, end: str, bullets: strs });
const project = z.object({ name: str, description: str, tech: strs, bullets: strs });
const education = z.object({ school: str, degree: str, field: str, start: str, end: str, details: strs });
const arr = <T extends z.ZodTypeAny>(t: T) => z.array(t).nullish().transform((v) => (v ?? []) as z.output<T>[]);
const profileSchema = z.object({
  contact, summary: str, experience: arr(experience), projects: arr(project), education: arr(education),
  skills: strs, certifications: strs, publications: strs,
});
const jdSchema = z.object({
  title: str, company: str, location: str, seniority: str, summary: str,
  must_have: strs, nice_to_have: strs, responsibilities: strs, keywords: strs, source_url: str,
});
const matchSchema = z.object({
  score: num(), keyword_score: num(), semantic_score: num(), matched: strs, missing: strs,
  strengths: strs, gaps: strs, suggestions: strs,
});
const kind = z.enum(["resume", "cv", "cover_letter"]).catch("resume");
const docSchema = z.object({
  kind, name: str, contact: strs,
  sections: arr(z.object({
    title: str, paragraphs: strs,
    items: arr(z.object({ heading: str, subheading: str, dates: str, note: str, bullets: strs })),
  })),
});
const generated = z.object({
  doc: docSchema,
  flags: arr(z.object({ text: str, section: num(), item: num(), bullet: num(), unsupported: strs, reason: str })),
  generatedAt: num(Date.now()),
});
const jobSchema = z.object({
  id: z.string().nullish().transform((v) => v || uid()),
  url: str, rawText: str,
  fetched: z.object({ source: str, url: str, text: str, title: str, company: str, location: str }).nullish().transform((v) => v ?? undefined),
  jd: jdSchema.nullish().transform((v) => v ?? null),
  match: matchSchema.nullish().transform((v) => (v ? { ...v, score: Math.min(100, Math.max(0, v.score)) } : null)),
  docs: z.record(z.string(), generated).nullish().transform((v) => {
    const out: Record<string, z.output<typeof generated>> = {};
    for (const [k, g] of Object.entries(v ?? {})) if (k === "resume" || k === "cv" || k === "cover_letter") out[k] = { ...g, doc: { ...g.doc, kind: k } };
    return out;
  }),
});
export const sessionSchema = z.object({
  app: z.literal("TailorUrResume"),
  version: z.literal(1),
  profile: profileSchema.nullish().transform((v) => v ?? null),
  profileFile: str,
  jobs: arr(jobSchema),
  activeJobId: z.string().nullish().transform((v) => v ?? null),
  template: z.enum(["classic", "modern", "compact"]).catch("classic"),
  provider: z.enum(["anthropic", "ollama"]).catch("anthropic"),
  model: str,
});

/** Validate + normalize an untrusted session file. Throws if it is not a TailorUrResume session. */
export function parseSession(raw: unknown): SessionFile {
  const s = sessionSchema.parse(raw) as unknown as SessionFile;
  if (!s.jobs.some((j) => j.id === s.activeJobId)) s.activeJobId = s.jobs[0]?.id ?? null;
  return s;
}

export function exportSession() {
  const s = buildSession();
  downloadBlob(new Blob([JSON.stringify(s, null, 2)], { type: "application/json" }), "tailorurresume-session.json");
  useStore.setState({ dirty: false });
  toast.success("Session saved", { description: "Your API key is not included in the file." });
}

export function importSessionFile(file: File) {
  file.text().then((t) => {
    try {
      const s = parseSession(JSON.parse(t));
      useStore.getState().loadSession(s);
      toast.success("Session restored", { description: "Re-enter your API key to continue generating." });
    } catch {
      toast.error("That file is not a valid TailorUrResume session.");
    }
  });
}

export function pickSessionFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = () => input.files?.[0] && importSessionFile(input.files[0]);
  input.click();
}
