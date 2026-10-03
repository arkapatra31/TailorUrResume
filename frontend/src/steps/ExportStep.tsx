import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Download, FileDown, Loader2, Save, Upload } from "lucide-react";
import { useState } from "react";
import { StepFooter, StepHeader } from "@/components/StepShell";
import { TemplatePicker } from "@/components/TemplatePicker";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { download, KIND_LABEL } from "@/lib/actions";
import { exportSession, pickSessionFile } from "@/lib/session";
import type { DocKind } from "@/lib/types";
import { useActiveJob, useStore } from "@/store";

function DownloadButton({ fmt, kind }: { fmt: "pdf" | "docx"; kind: DocKind }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const go = async () => {
    setState("busy");
    const ok = await download(fmt, kind);
    setState(ok ? "done" : "idle");
    if (ok) setTimeout(() => setState("idle"), 2200);
  };
  return (
    <Button size="lg" variant={fmt === "pdf" ? "default" : "glass"} onClick={go} disabled={state === "busy"} className="relative min-w-[190px] overflow-visible">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={state} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} className="inline-flex items-center gap-2">
          {state === "busy" ? <Loader2 className="animate-spin" /> : state === "done" ? <Check className="text-success" /> : <FileDown />}
          {state === "done" ? "Downloaded!" : `Download ${fmt.toUpperCase()}`}
        </motion.span>
      </AnimatePresence>
      {state === "done" && <motion.span aria-hidden initial={{ scale: 0.6, opacity: 0.8 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 0.8 }} className="pointer-events-none absolute inset-0 rounded-xl border-2 border-success" />}
    </Button>
  );
}

export function ExportStep() {
  const job = useActiveJob();
  const { activeKind, setActiveKind, template, setTemplate, setStep } = useStore();
  const g = job?.docs[activeKind];
  const available = job ? (Object.keys(job.docs) as DocKind[]) : [];

  return (
    <div>
      <StepHeader id="export" icon={FileDown} title="Ship it" subtitle="Pick an ATS-friendly template and download. Files are generated in memory and streamed straight to you." />
      <div className="mb-6">
        <Tabs value={activeKind} onValueChange={(v) => setActiveKind(v as DocKind)}>
          <TabsList>
            {(Object.keys(KIND_LABEL) as DocKind[]).map((k) => (
              <TabsTrigger key={k} value={k} disabled={!available.includes(k)}>{KIND_LABEL[k]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {g ? (
        <>
          <Card className="mb-6"><CardTitle className="mb-5">Template</CardTitle><TemplatePicker doc={g.doc} value={template} onChange={setTemplate} /></Card>
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div><CardTitle>Download {KIND_LABEL[activeKind]}</CardTitle><p className="mt-1 text-sm text-muted-foreground">PDF keeps selectable text for ATS parsers. DOCX is fully editable.</p></div>
            <div className="flex flex-wrap gap-3"><DownloadButton fmt="pdf" kind={activeKind} /><DownloadButton fmt="docx" kind={activeKind} /></div>
          </Card>
          {g.flags.length > 0 && <p className="mt-3 text-sm text-warn">{g.flags.length} unverified claim(s) remain in this document. Review them in the Craft step before sending.</p>}
        </>
      ) : (
        <Card className="text-center text-muted-foreground">Generate a document in the Craft step first.</Card>
      )}

      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div><CardTitle>Keep your work</CardTitle><p className="mt-1 text-sm text-muted-foreground">Nothing is stored anywhere. Save a session file to resume later. Your API key is never included.</p></div>
        <div className="flex gap-2"><Button variant="glass" onClick={exportSession}><Save />Save session</Button><Button variant="glass" onClick={pickSessionFile}><Upload />Load session</Button></div>
      </Card>

      <StepFooter>
        <Button variant="ghost" onClick={() => setStep(4)}><ArrowLeft />Back to editing</Button>
        <Button variant="glass" onClick={() => { useStore.getState().addJob(); setStep(2); }}><Download className="rotate-180" />Tailor for another job</Button>
      </StepFooter>
    </div>
  );
}
