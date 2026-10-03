import { create } from "zustand";
import type { DocKind, GeneratedDoc, Job, Profile, Provider, TemplateId } from "./lib/types";
import { uid } from "./lib/utils";

/**
 * In-memory only. There is intentionally NO persist middleware: refreshing the tab wipes
 * everything, including the API key. No localStorage, sessionStorage or cookies are used.
 */
export const STEPS = ["Key", "Profile", "Job", "Match", "Craft", "Export"] as const;

interface State {
  theme: "dark" | "light";
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl: string;
  connected: boolean;
  step: number;
  profile: Profile | null;
  profileFile: string;
  jobs: Job[];
  activeJobId: string | null;
  activeKind: DocKind;
  template: TemplateId;
  paletteOpen: boolean;
  dirty: boolean;

  setTheme: (t: "dark" | "light") => void;
  setSettings: (s: Partial<Pick<State, "provider" | "apiKey" | "model" | "baseUrl" | "connected">>) => void;
  setStep: (n: number) => void;
  setProfile: (p: Profile | null, file?: string) => void;
  addJob: () => string;
  updateJob: (id: string, patch: Partial<Job>) => void;
  removeJob: (id: string) => void;
  setActiveJob: (id: string) => void;
  setDoc: (id: string, kind: DocKind, doc: GeneratedDoc) => void;
  setActiveKind: (k: DocKind) => void;
  setTemplate: (t: TemplateId) => void;
  setPalette: (o: boolean) => void;
  loadSession: (s: SessionFile) => void;
}

export interface SessionFile {
  app: "TailorUrResume";
  version: 1;
  profile: Profile | null;
  profileFile: string;
  jobs: Job[];
  activeJobId: string | null;
  template: TemplateId;
  provider: Provider;
  model: string;
}

const newJob = (): Job => ({ id: uid(), url: "", rawText: "", jd: null, match: null, docs: {} });

export const useStore = create<State>((set, get) => ({
  theme: window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark",
  provider: "anthropic",
  apiKey: "",
  model: "claude-sonnet-5-5",
  baseUrl: "http://localhost:11434",
  connected: false,
  step: 0,
  profile: null,
  profileFile: "",
  jobs: [],
  activeJobId: null,
  activeKind: "resume",
  template: "classic",
  paletteOpen: false,
  dirty: false,

  setTheme: (theme) => set({ theme }),
  setSettings: (s) => set(s),
  setStep: (step) => set({ step }),
  setProfile: (profile, file) => set((st) => ({ profile, profileFile: file ?? st.profileFile, dirty: true })),
  addJob: () => {
    const j = newJob();
    set((st) => ({ jobs: [...st.jobs, j], activeJobId: j.id, dirty: true }));
    return j.id;
  },
  updateJob: (id, patch) => set((st) => ({ jobs: st.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)), dirty: true })),
  removeJob: (id) =>
    set((st) => {
      const jobs = st.jobs.filter((j) => j.id !== id);
      return { jobs, activeJobId: st.activeJobId === id ? jobs[0]?.id ?? null : st.activeJobId };
    }),
  setActiveJob: (activeJobId) => set({ activeJobId }),
  setDoc: (id, kind, doc) =>
    set((st) => ({ jobs: st.jobs.map((j) => (j.id === id ? { ...j, docs: { ...j.docs, [kind]: doc } } : j)), dirty: true })),
  setActiveKind: (activeKind) => set({ activeKind }),
  setTemplate: (template) => set({ template }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  loadSession: (s) =>
    set({
      profile: s.profile, profileFile: s.profileFile ?? "", jobs: s.jobs ?? [], activeJobId: s.activeJobId ?? s.jobs?.[0]?.id ?? null,
      template: s.template ?? "classic", provider: s.provider ?? get().provider, model: s.model || get().model,
      step: s.profile ? (s.jobs?.length ? 3 : 2) : get().step, dirty: false,
    }),
}));

export const useActiveJob = () => useStore((s) => s.jobs.find((j) => j.id === s.activeJobId) ?? null);

/** Session export intentionally omits the API key. */
export function buildSession(): SessionFile {
  const s = useStore.getState();
  return {
    app: "TailorUrResume", version: 1, profile: s.profile, profileFile: s.profileFile, jobs: s.jobs,
    activeJobId: s.activeJobId, template: s.template, provider: s.provider, model: s.model,
  };
}
