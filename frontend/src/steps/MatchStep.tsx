import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Gauge, Lightbulb, Link2, Loader2, PlusCircle, RefreshCw, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Confetti } from "@/components/Confetti";
import { GapPopover, VERDICT } from "@/components/GapPopover";
import { ScoreGauge, scoreTone } from "@/components/ScoreGauge";
import { StepFooter, StepHeader } from "@/components/StepShell";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { attestedOf, previewScore, removeAttested, sameSkill, upsertAttested } from "@/lib/bridge";
import type { BridgeItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useActiveJob, useStore } from "@/store";

function Chip({ t, ok, sorted }: { t: string; ok: boolean; sorted: boolean }) {
  return (
    // No `layout`/`layoutId` here: projection nodes inside a step that is animating out stalled AnimatePresence, leaving the next step blank
    // once the chips had re-sorted. A short pop-in on re-sort keeps the effect without that.
    <motion.span initial={{ opacity: 0.4, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm", !sorted ? "bg-muted" : ok ? "border-success/50 bg-success/15 text-success" : "border-danger/50 bg-danger/15 text-danger")}>
      {sorted && (ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />)}{t}
    </motion.span>
  );
}

/** A missing skill: click to include it (or not), with a bridge verdict badge once analysed. */
function GapChip({ t, item, added, open, onOpen }: { t: string; item?: BridgeItem; added: boolean; open: boolean; onOpen: () => void }) {
  const v = item ? VERDICT[item.verdict] : null;
  return (
    <button onClick={onOpen} aria-expanded={open} aria-label={`${t}${v ? `: ${v.label}` : ""}`}
      className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition hover:brightness-110",
        added ? "border-primary/50 bg-primary/20 text-foreground" : "border-danger/50 bg-danger/15 text-danger")}>
      {added ? <PlusCircle className="size-3.5" /> : <XCircle className="size-3.5" />}{t}
      {v && <span aria-hidden className={cn("ml-0.5 rounded-full bg-background/70 px-1.5 text-xs font-semibold", v.cls)}>{v.mark}</span>}
    </button>
  );
}

export function MatchStep() {
  const job = useActiveJob();
  const { profile, jobs, activeJobId, setActiveJob, updateJob, setStep, addJob, setProfile } = useStore();
  const [bridging, setBridging] = useState(false);
  const [openGap, setOpenGap] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sorted, setSorted] = useState(false);
  const [error, setError] = useState("");
  const reduce = useReducedMotion();
  const ran = useRef<string | null>(null);

  const run = useCallback(async () => {
    if (!job?.jd || !profile) return;
    setLoading(true); setSorted(false); setError("");
    try {
      const m = await api.match(profile, job.jd);
      updateJob(job.id, { match: m });
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg); toast.error(msg);
      ran.current = null; // allow a retry / re-entry to run again
    } finally { setLoading(false); }
  }, [job?.id, job?.jd, profile, updateJob]);

  useEffect(() => {
    if (job && !job.match && !error && ran.current !== job.id) { ran.current = job.id; run(); }
  }, [job, run, error]);

  const m = job?.match;
  useEffect(() => {
    if (!m) return;
    setSorted(!!reduce);
    const t = setTimeout(() => setSorted(true), 1500);
    return () => clearTimeout(t);
  }, [m, reduce]);

  const runBridge = async () => {
    if (!job?.jd || !profile || !m) return;
    setBridging(true);
    try {
      const { items } = await api.bridge(profile, job.jd, m.missing, m.gaps);
      updateJob(job.id, { bridge: items });
      const n = items.filter((i) => i.verdict === "supported").length;
      toast.success("Gaps analysed", { description: n ? `${n} skill(s) are backed by your existing experience.` : "None of the missing skills are backed by your profile." });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBridging(false); }
  };

  if (!job) return null;
  const attested = attestedOf(profile);
  const bridgeOf = (t: string) => job.bridge?.find((b) => sameSkill(b.skill, t));
  const attestedFor = (t: string) => attested.find((a) => sameSkill(a.skill, t));
  const added = m ? m.missing.filter((t) => attestedFor(t)) : [];
  const stillMissing = m ? m.missing.filter((t) => !attestedFor(t)) : [];
  const preview = m ? previewScore(m, job.jd, added) : null;
  const supportedPending = stillMissing.filter((t) => bridgeOf(t)?.verdict === "supported");
  const includeAllSupported = () => {
    if (!profile) return;
    let p = profile;
    for (const t of supportedPending) p = upsertAttested(p, { skill: t, evidence: bridgeOf(t)!.evidence.join(", "), self_attested: false });
    setProfile(p);
  };
  const gap = (t: string) => (
    <span key={t} className="relative">
      <GapChip t={t} item={bridgeOf(t)} added={!!attestedFor(t)} open={openGap === t} onOpen={() => setOpenGap(openGap === t ? null : t)} />
      {openGap === t && profile && (
        <GapPopover skill={t} item={bridgeOf(t)} attested={attestedFor(t)} onClose={() => setOpenGap(null)}
          onSave={(a) => setProfile(a ? upsertAttested(profile, a) : removeAttested(profile, t))} />
      )}
    </span>
  );
  const chips = m ? [...m.matched.map((t) => ({ t, ok: true })), ...m.missing.map((t) => ({ t, ok: false }))] : [];
  return (
    <div>
      <Confetti fire={!!m && m.score >= 85} />
      <StepHeader id="match" icon={Gauge} title="How well do you fit?" subtitle={`${job.jd?.title ?? "Role"}${job.jd?.company ? ` at ${job.jd.company}` : ""}: keyword coverage plus semantic fit.`} />

      {error && !loading && !m ? (
        <Card role="alert" className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
          <AlertTriangle className="size-10 text-danger" />
          <div><p className="font-semibold">We could not compare your profile with this job.</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></div>
          <Button onClick={() => { ran.current = job?.id ?? null; run(); }}><RefreshCw />Retry</Button>
        </Card>
      ) : loading || !m ? (
        <Card className="flex min-h-[280px] flex-col items-center justify-center gap-3" aria-busy="true">
          <Loader2 className="size-10 animate-spin text-accent" /><p className="text-muted-foreground">Comparing your profile with the job…</p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <Card className="flex flex-col items-center gap-5 px-8">
            <ScoreGauge score={preview!.score} />
            {added.length > 0 && <p className="-mt-2 text-xs text-muted-foreground">Preview with {added.length} added skill(s), was {m.score}</p>}
            <div className="grid w-full grid-cols-2 gap-3 text-center text-sm">
              <div className="rounded-xl bg-muted/60 p-3"><div className="text-xl font-semibold tabular-nums">{preview!.keyword}</div><div className="text-xs text-muted-foreground">Keywords</div></div>
              <div className="rounded-xl bg-muted/60 p-3"><div className="text-xl font-semibold tabular-nums">{m.semantic_score}</div><div className="text-xs text-muted-foreground">Semantic fit</div></div>
            </div>
            <Button variant="ghost" size="sm" onClick={run}><RefreshCw />Re-run</Button>
          </Card>

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Skills</CardTitle>
              {sorted && m.missing.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {supportedPending.length > 0 && <Button size="sm" variant="glass" onClick={includeAllSupported}><PlusCircle />Include all supported ({supportedPending.length})</Button>}
                  <Button size="sm" variant="glass" onClick={runBridge} disabled={bridging}>{bridging ? <Loader2 className="animate-spin" /> : <Link2 />}{job.bridge ? "Re-check gaps" : "Bridge gaps"}</Button>
                </div>
              )}
            </div>
            <LayoutGroup>
              {!sorted ? (
                <div className="flex flex-wrap gap-2">{chips.map((c) => <Chip key={c.t} {...c} sorted={sorted} />)}</div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-3">
                  <div><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-success">Matched ({m.matched.length})</div>
                    <div className="flex flex-wrap gap-2">{m.matched.map((t) => <Chip key={t} t={t} ok sorted={sorted} />)}{!m.matched.length && <span className="text-sm text-muted-foreground">None yet</span>}</div></div>
                  <div><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-danger">Missing ({stillMissing.length})</div>
                    <div className="flex flex-wrap gap-2">{stillMissing.map(gap)}{!stillMissing.length && <span className="text-sm text-muted-foreground">Nothing missing</span>}</div></div>
                  <div><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">Added ({added.length})</div>
                    <div className="flex flex-wrap gap-2">{added.map(gap)}{!added.length && <span className="text-sm text-muted-foreground">Click a missing skill you genuinely have</span>}</div></div>
                </div>
              )}
            </LayoutGroup>
            {sorted && m.missing.length > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                Have a missing skill under another name (e.g. Gen AI via LangChain)? Bridge gaps checks your experience; only added skills can appear in your documents.
              </p>
            )}
          </Card>

          <Card className="lg:col-span-2">
            <CardTitle className="mb-3 flex items-center gap-2"><Lightbulb className="size-4 text-warn" />Suggestions</CardTitle>
            <div className="grid gap-5 text-sm sm:grid-cols-3">
              {([["Strengths", m.strengths], ["Gaps", m.gaps], ["Next steps", m.suggestions]] as const).map(([h, list]) => (
                <div key={h}><div className="mb-2 font-medium">{h}</div>
                  <ul className="list-disc space-y-1.5 pl-4 text-muted-foreground">{list.map((x, i) => <li key={i}>{x}</li>)}{!list.length && <li>None</li>}</ul></div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Suggestions never mean inventing experience: the generator only uses facts from your profile.</p>
          </Card>

          {jobs.length > 1 && (
            <Card className="lg:col-span-2">
              <CardTitle className="mb-3">Compare jobs</CardTitle>
              <ul className="space-y-3">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <button onClick={() => setActiveJob(j.id)} className="w-full text-left" aria-label={`Select ${j.jd?.title ?? "job"}`}>
                      <div className="mb-1 flex justify-between text-sm"><span className={cn(j.id === activeJobId && "font-semibold")}>{j.jd?.title || "Untitled"} · {j.jd?.company}</span>
                        <span className="tabular-nums">{j.match ? j.match.score : "–"}</span></div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <motion.div className="h-full rounded-full" style={{ background: j.match ? scoreTone(j.match.score) : "transparent" }} initial={{ width: 0 }} animate={{ width: `${j.match?.score ?? 0}%` }} transition={{ duration: 0.9 }} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <StepFooter>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft />Back</Button>
          <Button variant="glass" onClick={() => { addJob(); setStep(2); }}>Compare another job</Button>
        </div>
        <Button size="lg" disabled={!m} onClick={() => setStep(4)}>Craft documents <ArrowRight /></Button>
      </StepFooter>
    </div>
  );
}
