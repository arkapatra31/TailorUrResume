import { motion } from "framer-motion";
import { Check, FileDown, FileText, Gauge, KeyRound, Link2, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEPS, useStore } from "@/store";

const ICONS = [KeyRound, FileText, Link2, Gauge, PenLine, FileDown];

function CompactStepper({ canGo }: { canGo: (i: number) => boolean }) {
  const step = useStore((s) => s.step);
  const setStep = useStore((s) => s.setStep);
  return (
    <nav aria-label="Progress" className="min-w-0 flex-1 sm:hidden">
      <ol className="flex items-center justify-between gap-0.5">
        {STEPS.map((label, i) => {
          const Icon = ICONS[i];
          const done = i < step, active = i === step;
          return (
            <li key={label}>
              <button type="button" disabled={!canGo(i)} onClick={() => setStep(i)} aria-current={active ? "step" : undefined} aria-label={`Step ${i + 1}: ${label}`}
                className="relative flex size-9 items-center justify-center disabled:cursor-not-allowed">
                {active && <motion.span layoutId="stepper-active-compact" className="absolute inset-0.5 rounded-full bg-primary" transition={{ type: "spring", stiffness: 300, damping: 26 }} />}
                <span className={cn("relative flex size-7 items-center justify-center rounded-full border transition-colors",
                  active ? "border-transparent text-primary-foreground" : done ? "border-success/60 bg-success/20 text-success" : "bg-background/80 text-muted-foreground")}>
                  {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Stepper({ canGo, compact = false }: { canGo: (i: number) => boolean; compact?: boolean }) {
  if (compact) return <CompactStepper canGo={canGo} />;
  const step = useStore((s) => s.step);
  const setStep = useStore((s) => s.setStep);
  return (
    <nav aria-label="Progress" className="glass mx-auto hidden w-full max-w-4xl sm:block rounded-2xl px-3 py-3 sm:px-8">
      <ol className="relative flex justify-between">
        {STEPS.map((label, i) => {
          const Icon = ICONS[i];
          const done = i < step, active = i === step, ok = canGo(i);
          return (
            <li key={label} className="flex w-1/6 flex-col items-center">
              <button
                type="button"
                disabled={!ok}
                onClick={() => setStep(i)}
                aria-current={active ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${label}`}
                className="group flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
              >
                <span className="relative flex size-9 items-center justify-center sm:size-10">
                  {active && (
                    <motion.span layoutId="stepper-active" className="absolute inset-0 rounded-full bg-primary shadow-[0_0_24px_4px_hsl(var(--primary)/0.65)]" transition={{ type: "spring", stiffness: 300, damping: 26 }} />
                  )}
                  <span className={cn("relative flex size-full items-center justify-center rounded-full border transition-colors",
                    active ? "border-transparent text-primary-foreground" : done ? "border-success/60 bg-success/20 text-success" : "bg-background/80 text-muted-foreground",
                    ok && !active && "group-hover:border-primary/70")}>
                    {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                  </span>
                </span>
                <span className={cn("text-[11px] font-medium sm:text-xs", active ? "text-foreground" : "text-muted-foreground", !active && "max-[420px]:hidden")}>{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
