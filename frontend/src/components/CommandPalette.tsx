import { Command } from "cmdk";
import { Download, FileDown, Moon, PenLine, Plus, Sparkles, Sun, Upload } from "lucide-react";
import { useEffect } from "react";
import { exportSession, pickSessionFile } from "@/lib/session";
import { STEPS, useStore } from "@/store";

export function CommandPalette({ canGo, onAction }: { canGo: (i: number) => boolean; onAction: (a: string) => void }) {
  const open = useStore((s) => s.paletteOpen);
  const setOpen = useStore((s) => s.setPalette);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const setStep = useStore((s) => s.setStep);
  const addJob = useStore((s) => s.addJob);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(!useStore.getState().paletteOpen); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [setOpen]);

  const run = (fn: () => void) => () => { setOpen(false); fn(); };
  const item = "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm aria-selected:bg-primary aria-selected:text-primary-foreground [&_svg]:size-4";

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Command palette" overlayClassName="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      contentClassName="glass glass-strong fixed left-1/2 top-[18%] z-50 w-[92vw] max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl">
      <Command.Input placeholder="Type a command…  (Esc to close)" className="w-full border-b bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground" />
      <Command.List className="scroll-thin max-h-80 overflow-auto p-2">
        <Command.Empty className="p-4 text-center text-sm text-muted-foreground">No matching command.</Command.Empty>
        <Command.Group heading="Go to" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
          {STEPS.map((s, i) => canGo(i) && (
            <Command.Item key={s} className={item} value={`go ${s}`} onSelect={run(() => setStep(i))}>
              <span className="w-4 text-center text-xs">{i + 1}</span>{s}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Actions" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
          <Command.Item className={item} onSelect={run(() => { addJob(); setStep(2); })}><Plus />Add another job</Command.Item>
          <Command.Item className={item} onSelect={run(() => onAction("gen-resume"))}><Sparkles />Generate tailored resume</Command.Item>
          <Command.Item className={item} onSelect={run(() => onAction("gen-cv"))}><PenLine />Generate full CV</Command.Item>
          <Command.Item className={item} onSelect={run(() => onAction("gen-cover"))}><PenLine />Generate cover letter</Command.Item>
          <Command.Item className={item} onSelect={run(() => onAction("pdf"))}><FileDown />Download PDF</Command.Item>
          <Command.Item className={item} onSelect={run(() => onAction("docx"))}><Download />Download DOCX</Command.Item>
        </Command.Group>
        <Command.Group heading="Session" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
          <Command.Item className={item} onSelect={run(exportSession)}><Download />Export session (.json, no key)</Command.Item>
          <Command.Item className={item} onSelect={run(pickSessionFile)}><Upload />Import session</Command.Item>
          <Command.Item className={item} onSelect={run(() => setTheme(theme === "dark" ? "light" : "dark"))}>
            {theme === "dark" ? <Sun /> : <Moon />}Toggle light / dark
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
