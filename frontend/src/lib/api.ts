import { useStore } from "@/store";
import type { Doc, FetchedJob, GeneratedDoc, JobDescription, MatchResult, Profile, TemplateId, TruthFlag } from "./types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

/** The key is read from memory per call and sent only as a header. */
function llmHeaders(): Record<string, string> {
  const s = useStore.getState();
  const h: Record<string, string> = { "X-LLM-Provider": s.provider, "X-LLM-Model": s.model };
  if (s.provider === "anthropic") h["X-LLM-Key"] = s.apiKey;
  else if (s.baseUrl.trim()) h["X-LLM-Base-Url"] = s.baseUrl.trim();
  return h;
}

async function fail(r: Response): Promise<never> {
  let detail = `Request failed (${r.status})`;
  try {
    const j = await r.json();
    if (typeof j.detail === "string") detail = j.detail;
    else if (Array.isArray(j.detail)) detail = "Invalid request data.";
  } catch { /* ignore */ }
  throw new ApiError(detail, r.status);
}

async function post<T>(path: string, body?: unknown, llm = true, form?: FormData, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = llm ? llmHeaders() : {};
  if (!form) headers["Content-Type"] = "application/json";
  let r: Response;
  try {
    r = await fetch(path, { method: "POST", headers, body: form ?? JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Cannot reach the server. Is the backend running?", 0);
  }
  if (!r.ok) await fail(r);
  return r.json();
}

export const api = {
  testConnection: () => post<{ ok: boolean; provider: string; model: string }>("/api/test-connection"),
  parseProfile: (file: File) => {
    const f = new FormData(); f.append("file", file);
    return post<Profile>("/api/profile/parse", undefined, true, f);
  },
  fetchJob: (url: string) => post<FetchedJob>("/api/jd/fetch", { url }, false),
  extractJd: (text: string, source_url: string) => post<JobDescription>("/api/jd/extract", { text, source_url }),
  match: (profile: Profile, jd: JobDescription) => post<MatchResult>("/api/match", { profile, jd }),
  regenerateBullet: (body: { profile: Profile; jd: JobDescription; bullet: string; context: string; instruction?: string }) =>
    post<{ bullet: string; unsupported: string[] }>("/api/regenerate-bullet", body),
  checkTruth: (profile: Profile, doc: Doc, jd: JobDescription) =>
    post<{ flags: TruthFlag[] }>("/api/check-truth", { profile, doc, jd }, false),

  async generate(
    body: { kind: Doc["kind"]; profile: Profile; jd: JobDescription; match: MatchResult | null; instructions?: string },
    onToken: (t: string) => void,
    signal?: AbortSignal,
  ): Promise<GeneratedDoc> {
    let r: Response;
    try {
      r = await fetch("/api/generate", { method: "POST", headers: { ...llmHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      throw new ApiError("Cannot reach the server. Is the backend running?", 0);
    }
    if (!r.ok || !r.body) await fail(r);
    const reader = r.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let result: GeneratedDoc | null = null;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, idx); buf = buf.slice(idx + 2);
        const ev = /^event: (.*)$/m.exec(block)?.[1];
        const data = /^data: (.*)$/m.exec(block)?.[1];
        if (!ev || !data) continue;
        const payload = JSON.parse(data);
        if (ev === "token") onToken(payload.text);
        else if (ev === "error") throw new ApiError(payload.detail ?? "Generation failed.", 502);
        else if (ev === "done") result = { doc: payload.doc, flags: payload.flags, generatedAt: Date.now() };
      }
    }
    if (!result) throw new ApiError("The stream ended unexpectedly.", 502);
    return result;
  },

  async exportFile(fmt: "pdf" | "docx", doc: Doc, template: TemplateId): Promise<Blob> {
    let r: Response;
    try {
      r = await fetch(`/api/export/${fmt}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc, template }) });
    } catch { throw new ApiError("Cannot reach the server. Is the backend running?", 0); }
    if (!r.ok) await fail(r);
    return r.blob();
  },
};
