import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Columns2, FileText, Loader2, PenLine, ShieldAlert, ShieldCheck, Sparkles, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DiffView } from "@/components/DiffView";
import { PaperDoc } from "@/components/PaperDoc";
import { StepFooter, StepHeader } from "@/components/StepShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { attestedOf } from "@/lib/bridge";
import { generate, KIND_LABEL, stopGeneration, useStream } from "@/lib/actions";
import { parseMarkdown } from "@/lib/markdown";
import type { Doc, DocKind } from "@/lib/types";
import { useActiveJob, useStore } from "@/store";

export function CraftStep() {
  const job = useActiveJob();
  const { profile, activeKind, setActiveKind, setDoc, setStep, template } = useStore();
  const stream = useStream();
  const [view, setView] = useState<"edit" | "diff">("edit");
  const [busy, setBusy] = useState<string | null>(null);
  const [instr, setInstr] = useState("");
  const [autoBridge, setAutoBridge] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const streamingHere = stream.active && stream.kind === activeKind && stream.jobId === job?.id;
  const streamDoc = useMemo(() => (streamingHere ? parseMarkdown(stream.text, activeKind) : null), [streamingHere, stream.text, activeKind]);
  const g = job?.docs[activeKind];

  if (!job || !job.jd || !profile) return null;
  const jd = job.jd;

  const recheck = (doc: Doc) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const { flags } = await api.checkTruth(profile, doc, jd);
        const cur = useStore.getState().jobs.find((j) => j.id === job.id)?.docs[activeKind];
        if (cur) setDoc(job.id, activeKind, { ...cur, flags });
      } catch { /* non-critical */ }
    }, 500);
  };

  const onChange = (doc: Doc) => {
    if (!g) return;
    setDoc(job.id, activeKind, { ...g, doc });
    recheck(doc);
  };

  const onRegen = async (s: number, i: number, b: number) => {
    if (!g) return;
    const item = g.doc.sections[s].items[i];
    const key = `${s}:${i}:${b}`;
    setBusy(key);
    try {
      const out = await api.regenerateBullet({ profile, jd, bullet: item.bullets[b], context: `${g.doc.sections[s].title}: ${item.heading} ${item.subheading}` });
      // Read the CURRENT doc after the await: the user may have edited while the request was in flight.
      const cur = useStore.getState().jobs.find((j) => j.id === job.id)?.docs[activeKind];
      if (!cur) return;
      const d = structuredClone(cur.doc);
      if (d.sections[s]?.items[i]?.bullets[b] === undefined) return;
      d.sections[s].items[i].bullets[b] = out.bullet;
      setDoc(job.id, activeKind, { ...cur, doc: d });
      recheck(d);
      toast.success("Bullet rewritten", { description: out.unsupported.length ? `Check: ${out.unsupported.join(", ")} is not in your profile.` : "Verified against your profile." });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const doc = streamDoc ?? g?.doc;
  const flags = (g?.flags ?? []).filter((f) => f.level !== "info");
  const notes = (g?.flags ?? []).filter((f) => f.level === "info");
  const added = attestedOf(profile).map((a) => a.skill).filter(Boolean);
  const quick = added.length
    ? ["Weave in added skills", ...added.slice(0, 3).map((s) => `Emphasize ${s}`)]
    : [];
  const addInstr = (q: string) => {
    const text = q === "Weave in added skills"
      ? "Weave the user-confirmed skills into the summary, skills and the most relevant bullets, grounded in their evidence"
      : q;
    setInstr((cur) => (cur.includes(text) ? cur : cur.trim() ? `${cur.trim()}; ${text}` : text));
  };

  return (
    <div>
      <StepHeader id="craft" icon={PenLine} title="Craft your documents" subtitle="Streamed live, editable in place. Click any text to edit it or use the refresh icon to rewrite a bullet. Claims not in your profile are flagged." />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={activeKind} onValueChange={(v) => setActiveKind(v as DocKind)}>
          <TabsList>
            {(Object.keys(KIND_LABEL) as DocKind[]).map((k) => (
              <TabsTrigger key={k} value={k}>{KIND_LABEL[k]}{job.docs[k] && <span className="size-1.5 rounded-full bg-success" aria-label="generated" />}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={view} onValueChange={(v) => setView(v as "edit" | "diff")}>
          <TabsList>
            <TabsTrigger value="edit"><FileText className="size-4" />Editor</TabsTrigger>
            <TabsTrigger value="diff" disabled={!g || activeKind === "cover_letter"}><Columns2 className="size-4" />Compare</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {view === "diff" && g && activeKind !== "cover_letter" ? (
            <DiffView profile={profile} tailored={g.doc} />
          ) : doc ? (
            <motion.div key={activeKind} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-[780px]">
              <PaperDoc doc={doc} template={template} flags={streamingHere ? [] : flags} editable={!streamingHere} streaming={streamingHere}
                busyKey={busy} onChange={onChange} onRegen={onRegen} tall={activeKind !== "resume" || !!doc.sections.length} fontSize={undefined} />
            </motion.div>
          ) : (
            <Card className="flex min-h-[380px] flex-col items-center justify-center gap-4 text-center">
              <div className="relative">
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent">
                  <Sparkles className="size-9 text-primary-foreground" />
                </motion.div>
              </div>
              <div><div className="text-lg font-semibold">No {KIND_LABEL[activeKind].toLowerCase()} yet</div>
                <p className="mt-1 text-sm text-muted-foreground">Tailored to {jd.title || "this role"}{jd.company ? ` at ${jd.company}` : ""}, using only facts from your profile.</p></div>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="space-y-3">
            <div><Label htmlFor="instr">Extra instructions (optional)</Label>
              <Input id="instr" placeholder="e.g. emphasize leadership, keep to one page" value={instr} onChange={(e) => setInstr(e.target.value)} />
              {quick.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {quick.map((q) => (
                    <button key={q} type="button" onClick={() => addInstr(q)}
                      className="rounded-full border border-primary/50 bg-primary/15 px-2.5 py-0.5 text-xs hover:bg-primary/25">{q}</button>
                  ))}
                </div>
              )}</div>
            {!!job.match?.missing.length && (
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={autoBridge} onChange={(e) => setAutoBridge(e.target.checked)} />
                <span>
                  Auto-add related missing skills
                  <span className="block text-xs text-muted-foreground">
                    We add only skills your existing experience backs (e.g. Gen AI from LangChain work). Skills you have no experience in, like an unused language, stay out.
                  </span>
                </span>
              </label>
            )}
            {stream.active ? (
              <Button className="w-full" variant="danger" onClick={stopGeneration}><Square />Stop</Button>
            ) : (
              <Button className="w-full" onClick={() => generate(activeKind, instr, autoBridge)}>
                {g ? <><Sparkles />Regenerate {KIND_LABEL[activeKind]}</> : <><Sparkles />Generate {KIND_LABEL[activeKind]}</>}
              </Button>
            )}
            {streamingHere && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Writing…</p>}
          </Card>

          <Card>
            <CardTitle className="mb-3 flex items-center gap-2">
              {g && !flags.length ? <ShieldCheck className="size-5 text-success" /> : <ShieldAlert className="size-5 text-warn" />}Truthfulness check
            </CardTitle>
            {!g ? <p className="text-sm text-muted-foreground">Generated text is checked against your profile.</p>
              : !flags.length ? <p className="text-sm text-success">Every claim traces back to your profile.</p>
              : (
                <ul className="space-y-3 text-sm">
                  {flags.map((f, i) => (
                    <li key={i} className="rounded-lg border border-warn/40 bg-warn/10 p-2.5">
                      <div className="mb-1 flex flex-wrap gap-1">{f.unsupported.map((u) => <Badge key={u} tone="warn">{u}</Badge>)}</div>
                      <p className="text-muted-foreground">{f.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            {notes.length > 0 && (
              <ul className="mt-3 space-y-2 text-sm">
                {notes.map((f, i) => (
                  <li key={i} className="rounded-lg border border-primary/40 bg-primary/10 p-2.5">
                    <div className="mb-1 flex flex-wrap gap-1">{f.unsupported.map((u) => <Badge key={u} tone="primary">{u}</Badge>)}</div>
                    <p className="text-xs text-muted-foreground">{f.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      <StepFooter>
        <Button variant="ghost" onClick={() => setStep(3)}><ArrowLeft />Back</Button>
        <Button size="lg" disabled={!Object.keys(job.docs).length} onClick={() => setStep(5)}>Export <ArrowRight /></Button>
      </StepFooter>
    </div>
  );
}
