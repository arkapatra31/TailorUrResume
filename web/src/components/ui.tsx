import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return <section id={id} className={cn("relative py-20 sm:py-28", className)}><div className="wrap">{children}</div></section>;
}

export function SectionHead({ eyebrow, title, sub, className }: { eyebrow: string; title: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <Reveal className={cn("mx-auto mb-12 max-w-2xl text-center sm:mb-14", className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-[2.6rem] sm:leading-[1.1]">{title}</h2>
      {sub && <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">{sub}</p>}
    </Reveal>
  );
}

/** Fades content up once it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }} transition={{ duration: 0.6, delay, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

const btn = {
  primary: "bg-primary text-primary-foreground shadow-[0_10px_30px_-10px_hsl(var(--primary))] hover:shadow-[0_14px_36px_-10px_hsl(var(--primary))]",
  ghost: "glass text-foreground hover:bg-[hsl(var(--glass-strong))]",
};
export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<"a"> & { variant?: keyof typeof btn }) {
  return (
    <a {...props} className={cn("inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 [&_svg]:size-4", btn[variant], className)} />
  );
}

export function BrowserFrame({ url = "localhost:3000", className, children }: { url?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("glass overflow-hidden rounded-2xl p-0", className)}>
      <div className="flex items-center gap-3 border-b bg-[hsl(var(--glass))] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <i key={i} className="size-2.5 rounded-full bg-[hsl(var(--border))]" />)}</span>
        <span className="mx-auto max-w-xs flex-1 truncate rounded-md bg-muted/70 px-3 py-1 text-center font-mono text-[11px] text-muted-foreground">{url}</span>
        <span className="w-[42px]" aria-hidden />
      </div>
      {children}
    </div>
  );
}

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label={done ? "Copied" : "Copy commands"} className={cn("inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10", className)}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { return; }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}>
      {done ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
      <span className="hidden sm:inline">{done ? "Copied" : "Copy"}</span>
    </button>
  );
}

export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const verdictStyle = {
  supported: "border-success/40 bg-success/10 text-success",
  partial: "border-warn/40 bg-warn/10 text-warn",
  unsupported: "border-danger/40 bg-danger/10 text-danger",
};
export function VerdictBadge({ verdict, className }: { verdict: keyof typeof verdictStyle; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize", verdictStyle[verdict], className)}>
      {verdict}
    </span>
  );
}
