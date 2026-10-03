import { AnimatePresence, motion } from "framer-motion";
import { Command as CmdIcon, Download, Save, Sparkles, Upload } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Toaster } from "sonner";
import { Aurora } from "@/components/Aurora";
import { CommandPalette } from "@/components/CommandPalette";
import { Stepper } from "@/components/Stepper";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { download, generate } from "@/lib/actions";
import { exportSession, pickSessionFile } from "@/lib/session";
import { CraftStep } from "@/steps/CraftStep";
import { ExportStep } from "@/steps/ExportStep";
import { JobStep } from "@/steps/JobStep";
import { KeyStep } from "@/steps/KeyStep";
import { MatchStep } from "@/steps/MatchStep";
import { ProfileStep } from "@/steps/ProfileStep";
import { useActiveJob, useStore } from "@/store";

export default function App() {
  const { step, theme, provider, apiKey, baseUrl, profile, jobs, dirty, setPalette } = useStore();
  const job = useActiveJob();

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  // Warn before losing in-memory work.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (useStore.getState().dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const keyOk = provider === "ollama" ? !!baseUrl : !!apiKey;
  const canGo = useCallback((i: number) => {
    if (i === 0) return true;
    if (!keyOk) return false;
    if (i === 1) return true;
    if (!profile) return false;
    if (i === 2) return true;
    if (!job?.jd) return false;
    if (i === 3) return true;
    if (i === 4) return !!job.match || Object.keys(job.docs).length > 0;
    return Object.keys(job.docs).length > 0;
  }, [keyOk, profile, job]);

  const onAction = (a: string) => {
    if (a === "gen-resume") generate("resume");
    else if (a === "gen-cv") generate("cv");
    else if (a === "gen-cover") generate("cover_letter");
    else if (a === "pdf" || a === "docx") download(a);
  };

  const steps = [KeyStep, ProfileStep, JobStep, MatchStep, CraftStep, ExportStep];
  const Current = steps[step];

  return (
    <TooltipProvider>
      <Aurora />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">Skip to content</a>
      <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg"><Sparkles className="size-5 text-white" /></span>
              <span className="text-lg font-bold tracking-tight">Tailor<span className="text-gradient">Ur</span>Resume</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="glass" size="sm" className="hidden sm:inline-flex" onClick={() => setPalette(true)} aria-label="Open command palette">
                <CmdIcon />Commands <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd>
              </Button>
              <Button variant="glass" size="icon" className="sm:hidden" onClick={() => setPalette(true)} aria-label="Open command palette"><CmdIcon /></Button>
              <Button variant="glass" size="icon" onClick={exportSession} aria-label="Save session"><Save /></Button>
              <Button variant="glass" size="icon" onClick={pickSessionFile} aria-label="Load session"><Upload /></Button>
              <ThemeToggle />
            </div>
          </div>
          <Stepper canGo={canGo} />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 40, filter: "blur(6px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: -40, filter: "blur(6px)" }} transition={{ duration: 0.28 }}>
            <Current />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="px-4 pb-8 text-center text-xs text-muted-foreground">
        <Download className="mr-1 inline size-3" />Nothing is stored. Closing this tab erases your session{jobs.length || dirty ? ", so save it first" : ""}.
      </footer>

      <CommandPalette canGo={canGo} onAction={onAction} />
      <Toaster theme={theme} position="bottom-right" richColors closeButton />
    </TooltipProvider>
  );
}
