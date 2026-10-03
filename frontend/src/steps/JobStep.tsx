import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Building2, ClipboardPaste, Link2, Loader2, MapPin, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StepFooter, StepHeader } from "@/components/StepShell";
import { TagInput } from "@/components/TagInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type { FetchedJob, JobDescription } from "@/lib/types";
import { cn, hostOf } from "@/lib/utils";
import { useActiveJob, useStore } from "@/store";

function Favicon({ url, name }: { url: string; name: string }) {
  const [bad, setBad] = useState(false);
  const host = hostOf(url);
  return host && !bad ? (
    <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" width={40} height={40} onError={() => setBad(true)} className="size-10 rounded-lg bg-white p-1" />
  ) : (
    <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">{(name || "?")[0]?.toUpperCase()}</span>
  );
}

function JobCard({ f, url }: { f: FetchedJob; url: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24, scale: 0.9, filter: "blur(12px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 140, damping: 16 }} className="glass flex items-center gap-4 rounded-2xl p-4">
      <Favicon url={url} name={f.company || f.title} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{f.title || "Job posting"}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {f.company && <span className="inline-flex items-center gap-1"><Building2 className="size-3.5" />{f.company}</span>}
          {f.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{f.location}</span>}
        </div>
      </div>
      <Badge tone="primary">{f.source}</Badge>
    </motion.div>
  );
}

const SkeletonCard = () => (
  <div className="glass flex items-center gap-4 rounded-2xl p-4" aria-busy="true" aria-label="Fetching job posting">
    <div className="shimmer size-10 rounded-lg" />
    <div className="flex-1 space-y-2"><div className="shimmer h-4 w-2/3" /><div className="shimmer h-3 w-1/3" /></div>
  </div>
);

export function JobStep() {
  const { jobs, activeJobId, addJob, setActiveJob, updateJob, removeJob, setStep, profile } = useStore();
  const job = useActiveJob();
  const [tab, setTab] = useState<"paste" | "url">("paste");
  const [fetching, setFetching] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [notice, setNotice] = useState("");

  if (!job) {
    return (
      <div>
        <StepHeader id="job" icon={Link2} title="Pick your target" subtitle="Paste a job description or fetch it from a posting URL." />
        <Button size="lg" onClick={() => addJob()}><Plus />Add a job</Button>
      </div>
    );
  }

  const fetchUrl = async () => {
    if (!job.url.trim()) return;
    setFetching(true); setNotice("");
    try {
      const f = await api.fetchJob(job.url.trim());
      updateJob(job.id, { fetched: f, rawText: f.text, url: f.url || job.url });
    } catch (e) {
      setTab("paste");
      setNotice(`Could not fetch that URL: ${(e as Error).message} Paste the job description text instead.`);
      updateJob(job.id, { fetched: undefined });
    } finally { setFetching(false); }
  };

  const extract = async () => {
    setExtracting(true);
    try {
      const jd = await api.extractJd(job.rawText, job.url);
      updateJob(job.id, { jd, match: null, docs: {} });
      toast.success("Job parsed", { description: `${jd.title || "Role"} at ${jd.company || "company"}` });
    } catch (e) { toast.error((e as Error).message); }
    finally { setExtracting(false); }
  };

  const setJd = (patch: Partial<JobDescription>) => job.jd && updateJob(job.id, { jd: { ...job.jd, ...patch }, match: null });
  const jd = job.jd;

  return (
    <div>
      <StepHeader id="job" icon={Link2} title="Pick your target" subtitle="Paste a job description or fetch it from a posting URL. You can add several jobs and compare them." />

      <div className="mb-5 flex flex-wrap items-center gap-2" role="tablist" aria-label="Jobs">
        {jobs.map((j, i) => (
          <button key={j.id} role="tab" aria-selected={j.id === activeJobId} onClick={() => setActiveJob(j.id)}
            className={cn("glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-all", j.id === activeJobId && "!bg-primary text-primary-foreground")}>
            {j.jd?.title || `Job ${i + 1}`}{j.jd?.company ? ` · ${j.jd.company}` : ""}
          </button>
        ))}
        <Button size="sm" variant="glass" onClick={() => { addJob(); setNotice(""); }}><Plus />Add job</Button>
        {jobs.length > 1 && <Button size="sm" variant="ghost" onClick={() => removeJob(job.id)}><Trash2 />Remove this job</Button>}
      </div>

      <Card className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "paste" | "url")}>
          <TabsList>
            <TabsTrigger value="paste"><ClipboardPaste className="size-4" />Paste JD</TabsTrigger>
            <TabsTrigger value="url"><Link2 className="size-4" />Job posting URL</TabsTrigger>
          </TabsList>
        </Tabs>

        <AnimatePresence>
          {notice && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} role="alert"
              className="flex items-start gap-2 overflow-hidden rounded-xl border border-warn/50 bg-warn/10 p-3 text-sm text-warn">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />{notice}
            </motion.div>
          )}
        </AnimatePresence>

        {tab === "url" ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input aria-label="Job posting URL" placeholder="https://www.linkedin.com/jobs/view/…  ·  Greenhouse  ·  Lever  ·  any careers page"
                value={job.url} onChange={(e) => updateJob(job.id, { url: e.target.value })} onKeyDown={(e) => e.key === "Enter" && fetchUrl()} />
              <Button onClick={fetchUrl} disabled={fetching || !job.url.trim()}>{fetching ? <Loader2 className="animate-spin" /> : <Link2 />}Fetch</Button>
            </div>
            <p className="text-xs text-muted-foreground">Fetched once, only when you click. LinkedIn access is unofficial and may be blocked; see the README for the terms-of-service note.</p>
            {fetching && <SkeletonCard />}
            {!fetching && job.fetched && <JobCard f={job.fetched} url={job.url} />}
            {!fetching && job.fetched && (
              <div><Label htmlFor="ft">Fetched text (edit freely)</Label>
                <Textarea id="ft" rows={10} value={job.rawText} onChange={(e) => updateJob(job.id, { rawText: e.target.value })} /></div>
            )}
          </div>
        ) : (
          <div><Label htmlFor="jd">Job description</Label>
            <Textarea id="jd" rows={12} placeholder="Paste the full job description here…" value={job.rawText} onChange={(e) => updateJob(job.id, { rawText: e.target.value })} /></div>
        )}

        <Button onClick={extract} disabled={extracting || job.rawText.trim().length < 20}>
          {extracting ? <Loader2 className="animate-spin" /> : <Sparkles />}{jd ? "Re-extract details" : "Extract details"}
        </Button>
      </Card>

      <AnimatePresence>
        {(extracting || jd) && (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
            {extracting && !jd ? <SkeletonCard /> : jd && (
              <Card className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Title</Label><Input value={jd.title} onChange={(e) => setJd({ title: e.target.value })} /></div>
                  <div><Label>Company</Label><Input value={jd.company} onChange={(e) => setJd({ company: e.target.value })} /></div>
                  <div><Label>Location</Label><Input value={jd.location} onChange={(e) => setJd({ location: e.target.value })} /></div>
                  <div><Label>Seniority</Label><Input value={jd.seniority} onChange={(e) => setJd({ seniority: e.target.value })} /></div>
                </div>
                <div><Label>Must-have skills</Label><TagInput tone="primary" value={jd.must_have} onChange={(v) => setJd({ must_have: v })} /></div>
                <div><Label>Nice to have</Label><TagInput value={jd.nice_to_have} onChange={(v) => setJd({ nice_to_have: v })} /></div>
                <div><Label>ATS keywords</Label><TagInput value={jd.keywords} onChange={(v) => setJd({ keywords: v })} /></div>
                <div><Label>Responsibilities (one per line)</Label>
                  <Textarea rows={5} value={jd.responsibilities.join("\n")} onChange={(e) => setJd({ responsibilities: e.target.value.split("\n") })} /></div>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <StepFooter>
        <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft />Back</Button>
        <Button size="lg" disabled={!jd || !profile} onClick={() => setStep(3)}>Analyze match <ArrowRight /></Button>
      </StepFooter>
    </div>
  );
}
