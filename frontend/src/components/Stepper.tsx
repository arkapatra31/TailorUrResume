import { motion } from "framer-motion";
import { Check, FileDown, FileText, Gauge, KeyRound, Link2, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEPS, useStore } from "@/store";

const ICONS = [KeyRound, FileText, Link2, Gauge, PenLine, FileDown];

export function Stepper({ canGo }: { canGo: (i: number) => boolean }) {
  const step = useStore((s) => s.step);
  const setStep = useStore((s) => s.setStep);
  const pct = (step / (STEPS.length - 1)) * 100;
  return (
    <nav aria-label="Progress" className="glass relative mx-auto w-full max-w-4xl rounded-2xl px-3 py-3 sm:px-8">
      <div className="absolute left-[8%] right-[8%] top-[34px] h-0.5 rounded bg-muted sm:top-[38px]">
        <motion.div className="h-full rounded bg-gradient-to-r from-primary to-accent" animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      </div>
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
