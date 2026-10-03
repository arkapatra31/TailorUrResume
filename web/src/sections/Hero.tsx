import { animate, AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, CircleCheck, CirclePlus, CircleX, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ButtonLink, GithubIcon } from "@/components/ui";
import { JD, MATCHED, SCORE } from "@/lib/demo";
import { cn, REPO } from "@/lib/utils";

const fade = (delay: number) => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] } });

export function Hero() {
  return (
    <section id="top" className="relative pb-12 pt-12 sm:pb-20 sm:pt-20">
      <div className="grid-fade pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="wrap grid items-center gap-12 lg:grid-cols-[1.02fr_1fr] lg:gap-14">
        <div>
          <motion.a {...fade(0)} href={REPO} target="_blank" rel="noopener"
            className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground sm:text-sm">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-primary" /></span>
            Open source · Apache-2.0 · Bring your own key
          </motion.a>
          <motion.h1 {...fade(0.08)} className="mt-6 text-balance text-[2.6rem] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-6xl lg:text-[4.1rem]">
            Tailor your resume to every job. <span className="text-gradient">Fabricate nothing.</span>
          </motion.h1>
          <motion.p {...fade(0.16)} className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
            Upload your resume, point it at a job posting, and get a tailored resume, full CV and cover letter.
            Every claim is checked against your own profile. It runs on your Anthropic key or a local Ollama model.
          </motion.p>
          <motion.div {...fade(0.24)} className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="#start">Run it locally <ArrowRight /></ButtonLink>
            <ButtonLink href={REPO} target="_blank" rel="noopener" variant="ghost"><GithubIcon /> View on GitHub</ButtonLink>
          </motion.div>
          <motion.ul {...fade(0.32)} className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["No database", "No disk writes", "Anthropic or Ollama", "PDF & DOCX"].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><Check className="size-4 text-primary" />{t}</li>
            ))}
          </motion.ul>
        </div>
        <motion.div {...fade(0.2)}><HeroDemo /></motion.div>
      </div>
    </section>
  );
}

const STAGES = [
  { label: "Match", ms: 2800 },
  { label: "Bridge", ms: 2800 },
  { label: "Craft", ms: 3600 },
  { label: "Verify", ms: 3400 },
];
const MISSING = JD.must_have.concat(JD.nice_to_have).filter((s) => !MATCHED.includes(s));
const ADDED = ["Gen AI", "SQL"];
const BEFORE = "Built LLM apps with LangChain and the Claude SDK used by 3 internal teams.";
const AFTER = "Built Gen AI apps with LangChain and the Claude SDK used by 3 internal teams.";
const R = 44, C = 2 * Math.PI * R;

/** A looping, scripted run of the pipeline: score, bridge the gaps, rewrite a bullet, verify. */
function HeroDemo() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [phase, setPhase] = useState(0);
  const [score, setScore] = useState(0);
  const [typed, setTyped] = useState(0);
  const p = reduce ? 3 : phase;

  useEffect(() => {
    if (reduce || !inView) return;
    const t = setTimeout(() => setPhase((x) => (x + 1) % STAGES.length), STAGES[phase].ms);
    return () => clearTimeout(t);
  }, [phase, inView, reduce]);

  useEffect(() => {
    if (reduce) { setScore(SCORE.after); return; }
    if (p > 1) return;
    const c = animate(p === 0 ? 0 : SCORE.before, p === 0 ? SCORE.before : SCORE.after,
      { duration: p === 0 ? 1.4 : 1.1, delay: p === 0 ? 0.2 : 0.6, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => setScore(Math.round(v)) });
    return () => c.stop();
  }, [p, reduce]);

  useEffect(() => {
    if (p < 2) { setTyped(0); return; }
    if (reduce || p === 3) { setTyped(AFTER.length); return; }
    let i = 0;
    const t = setInterval(() => { i += 1; setTyped(i); if (i >= AFTER.length) clearInterval(t); }, 32);
    return () => clearInterval(t);
  }, [p, reduce]);

  const bridged = p >= 1;
  const genAi = AFTER.indexOf("Gen AI");
  const shown = AFTER.slice(0, typed);

  return (
    <div ref={ref} className="glass relative overflow-hidden rounded-2xl" aria-label="Animated example of a tailoring run" role="img">
      <div className="flex items-center gap-3 border-b bg-[hsl(var(--glass))] px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <i key={i} className="size-2.5 rounded-full bg-[hsl(var(--border))]" />)}</span>
        <span className="truncate text-sm font-medium text-muted-foreground">{JD.title} · {JD.company}</span>
      </div>

      <div className="grid grid-cols-4 gap-1.5 px-5 pt-4" aria-hidden>
        {STAGES.map((s, i) => (
          <div key={s.label}>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              {i < p && <div className="h-full w-full bg-primary" />}
              {i === p && <motion.div key={`${phase}`} className="h-full bg-primary" initial={{ width: reduce ? "100%" : "0%" }} animate={{ width: "100%" }} transition={{ duration: s.ms / 1000, ease: "linear" }} />}
            </div>
            <p className={cn("mt-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors", i <= p ? "text-foreground" : "text-muted-foreground/70")}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid items-center gap-5 p-5 sm:grid-cols-[auto_1fr]">
        <div className="relative mx-auto size-[112px]">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r={R} fill="none" strokeWidth="8" className="stroke-muted" />
            <circle cx="50" cy="50" r={R} fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-primary"
              strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} />
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <span className="text-3xl font-extrabold tabular-nums leading-none">{score}</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">match</span>
          </div>
        </div>
        <LayoutGroup>
          <div className="grid gap-3 text-xs">
            <ChipRow label="Matched">
              {MATCHED.map((s) => <Chip key={s} tone="ok" icon={<CircleCheck />}>{s}</Chip>)}
            </ChipRow>
            <ChipRow label="Missing">
              {MISSING.filter((s) => !(bridged && ADDED.includes(s))).map((s) => (
                <Chip key={s} id={s} tone={bridged ? (s === "Kubernetes" ? "warn" : "no") : "no"} icon={<CircleX />}
                  suffix={bridged ? (s === "Kubernetes" ? "≈" : s === "Rust" ? "?" : undefined) : undefined}>{s}</Chip>
              ))}
            </ChipRow>
            <ChipRow label="Added">
              {bridged ? ADDED.map((s) => <Chip key={s} id={s} tone="add" icon={<CirclePlus />}>{s}</Chip>)
                : <span className="py-1 text-muted-foreground/70">Bridge gaps to add skills you can back up</span>}
            </ChipRow>
          </div>
        </LayoutGroup>
      </div>

      <div className="border-t px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Experience bullet</p>
        <p className={cn("mt-2 text-sm transition-all duration-500", p >= 2 ? "text-muted-foreground/80 line-through decoration-danger/70" : "text-foreground")}>{BEFORE}</p>
        <p className="mt-1.5 min-h-[2.6em] text-sm font-medium">
          {p >= 2 && (
            <>
              {shown.slice(0, genAi)}
              {typed > genAi && <mark className="rounded bg-primary/20 px-0.5 text-foreground">{shown.slice(genAi, genAi + 6)}</mark>}
              {shown.slice(genAi + 6)}
              {typed < AFTER.length && <span className="caret" aria-hidden />}
            </>
          )}
        </p>
      </div>

      <div className="flex min-h-[52px] items-center gap-2.5 border-t bg-[hsl(var(--glass))] px-5 py-3 text-sm">
        <AnimatePresence mode="wait" initial={false}>
          {p === 3 ? (
            <motion.p key="ok" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2.5">
              <ShieldCheck className="size-4 shrink-0 text-primary" />
              <span className="text-muted-foreground"><b className="font-semibold text-foreground">0 unverified claims.</b> Kubernetes and Rust stay out.</span>
            </motion.p>
          ) : (
            <motion.p key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2.5 text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 opacity-50" /> Truth check runs after every draft
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[64px_1fr] items-start gap-2">
      <span className="pt-1.5 font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex min-h-[28px] flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

const tones = {
  ok: "border-success/35 bg-success/10 text-foreground [&>svg]:text-success",
  no: "border-danger/35 bg-danger/10 text-foreground [&>svg]:text-danger",
  warn: "border-warn/40 bg-warn/10 text-foreground [&>svg]:text-warn",
  add: "border-primary/50 bg-primary/15 text-foreground [&>svg]:text-primary",
};
function Chip({ id, tone, icon, suffix, children }: { id?: string; tone: keyof typeof tones; icon: ReactNode; suffix?: string; children: ReactNode }) {
  return (
    <motion.span layout layoutId={id} transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium [&>svg]:size-3.5", tones[tone])}>
      {icon}{children}{suffix && <span className="ml-0.5 font-bold opacity-80">{suffix}</span>}
    </motion.span>
  );
}
