import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, FileText, Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ProfileEditor } from "@/components/ProfileEditor";
import { StepFooter, StepHeader } from "@/components/StepShell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { emptyProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";

export function ProfileStep() {
  const { profile, profileFile, setProfile, setStep } = useStore();
  const [scanning, setScanning] = useState(false);
  const [drag, setDrag] = useState(false);
  const [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) { toast.error("Please upload a PDF or DOCX file."); return; }
    setName(file.name); setScanning(true);
    try {
      const p = await api.parseProfile(file);
      setProfile(p, file.name);
      toast.success("Profile parsed", { description: "Review and edit anything the AI got wrong." });
    } catch (e) { toast.error((e as Error).message); }
    finally { setScanning(false); }
  };

  return (
    <div>
      <StepHeader id="profile" icon={FileText} title="Your story, structured" subtitle="Drop your current resume. It is parsed in memory and never stored. Every field stays editable." />
      <AnimatePresence mode="wait">
        {!profile || scanning ? (
          <motion.div key="drop" exit={{ opacity: 0, scale: 0.97 }}>
            <div
              role="button" tabIndex={0} aria-label="Upload resume: drag and drop or press Enter to browse"
              onClick={() => !scanning && input.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !scanning && input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
              className={cn("glass relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center transition-all",
                drag ? "scale-[1.01] border-accent bg-accent/10" : "hover:border-primary/70")}
            >
              {scanning && (
                <>
                  <div className="laser" aria-hidden="true" />
                  <div className="absolute inset-0 bg-gradient-to-b from-accent/10 via-transparent to-accent/10" aria-hidden="true" />
                </>
              )}
              <motion.div animate={scanning ? { scale: [1, 1.06, 1] } : { y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.4 }} className="relative">
                {scanning ? <Loader2 className="size-14 animate-spin text-accent" /> : <UploadCloud className="size-14 text-primary" />}
              </motion.div>
              <p className="relative mt-4 text-lg font-semibold">{scanning ? `Scanning ${name}…` : "Drop your resume here"}</p>
              <p className="relative mt-1 text-sm text-muted-foreground">{scanning ? "Reading sections, roles and skills" : "PDF or DOCX, up to 5 MB, or click to browse"}</p>
              <input ref={input} type="file" accept=".pdf,.docx" hidden onChange={(e) => handle(e.target.files?.[0])} />
            </div>
            {!scanning && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                No resume handy?{" "}
                <button className="underline underline-offset-4 hover:text-foreground" onClick={() => setProfile(emptyProfile(), "manual")}>Start from a blank profile</button>
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>Parsed from <b className="text-foreground">{profileFile}</b></span>
              <Button size="sm" variant="ghost" onClick={() => setProfile(null)}>Upload a different file</Button>
            </div>
            <ProfileEditor profile={profile} onChange={(p) => setProfile(p)} />
          </motion.div>
        )}
      </AnimatePresence>
      <StepFooter>
        <Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft />Back</Button>
        <Button size="lg" disabled={!profile || scanning} onClick={() => setStep(2)}>Continue <ArrowRight /></Button>
      </StepFooter>
    </div>
  );
}
