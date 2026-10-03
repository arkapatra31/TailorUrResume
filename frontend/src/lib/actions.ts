import { toast } from "sonner";
import { create } from "zustand";
import { useStore } from "@/store";
import { api } from "./api";
import { downloadBlob } from "./utils";
import type { DocKind } from "./types";

interface StreamState { active: boolean; kind: DocKind | null; jobId: string | null; text: string }
export const useStream = create<StreamState>(() => ({ active: false, kind: null, jobId: null, text: "" }));

let controller: AbortController | null = null;
export const KIND_LABEL: Record<DocKind, string> = { resume: "Resume", cv: "CV", cover_letter: "Cover letter" };

export async function generate(kind: DocKind, instructions = "") {
  const s = useStore.getState();
  const job = s.jobs.find((j) => j.id === s.activeJobId);
  if (!s.profile || !job?.jd) { toast.error("Add your profile and a job first."); return; }
  if (useStream.getState().active) return;
  controller = new AbortController();
  useStore.setState({ activeKind: kind, step: 4 });
  useStream.setState({ active: true, kind, jobId: job.id, text: "" });
  try {
    const result = await api.generate(
      { kind, profile: s.profile, jd: job.jd, match: job.match, instructions },
      (t) => useStream.setState((st) => ({ text: st.text + t })),
      controller.signal,
    );
    useStore.getState().setDoc(job.id, kind, result);
    toast.success(`${KIND_LABEL[kind]} ready`, {
      description: result.flags.length ? `${result.flags.length} claim(s) flagged for review.` : "Every claim traces back to your profile.",
    });
  } catch (e) {
    if ((e as Error).name !== "AbortError") toast.error((e as Error).message);
  } finally {
    useStream.setState({ active: false });
    controller = null;
  }
}

export const stopGeneration = () => controller?.abort();

export async function download(fmt: "pdf" | "docx", kind?: DocKind): Promise<boolean> {
  const s = useStore.getState();
  const job = s.jobs.find((j) => j.id === s.activeJobId);
  const g = job?.docs[kind ?? s.activeKind];
  if (!g) { toast.error("Generate that document first."); return false; }
  try {
    const blob = await api.exportFile(fmt, g.doc, s.template);
    const base = (g.doc.name || "document").replace(/[^A-Za-z0-9]+/g, "_");
    downloadBlob(blob, `${base}_${{ resume: "Resume", cv: "CV", cover_letter: "Cover_Letter" }[g.doc.kind]}.${fmt}`);
    return true;
  } catch (e) {
    toast.error((e as Error).message);
    return false;
  }
}
