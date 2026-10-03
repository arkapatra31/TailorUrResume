import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, FlaskConical, Minus, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Reveal, Section, VerdictBadge } from "@/components/ui";
import { BRIDGE, PROFILE, type BridgeCase } from "@/lib/demo";
import { cn } from "@/lib/utils";

const RULES = [
  "Evidence must literally appear in your profile, or the verdict collapses to unsupported.",
  "Only skills you approve can appear in your documents. Everything else goes on a do-not-claim list.",
  "Approved skills are worked in by rephrasing your wording, never by new bullets or achievements.",
  "Prefer hands-off? Auto-bridge in the Craft step adds supported skills and keeps partial ones as related experience only.",
];

export function Bridge() {
  const [sel, setSel] = useState(BRIDGE[0].skill);
  const c = BRIDGE.find((b) => b.skill === sel)!;
  const real = BRIDGE.filter((b) => b.skill !== "AWS");
  const probe = BRIDGE.find((b) => b.skill === "AWS")!;

  return (
    <Section id="bridge">
      <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <Reveal className="lg:sticky lg:top-28">
          <p className="eyebrow">Skill bridge</p>
          <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-[2.6rem] sm:leading-[1.1]">A missing keyword isn't always a missing skill.</h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            For every job skill your resume doesn't name, the bridge asks whether experience you already have demonstrates it.
            PostgreSQL proves SQL. Python doesn't prove Java.
          </p>
          <ul className="mt-7 grid gap-3.5">
            {RULES.map((r) => (
              <li key={r} className="flex gap-3 text-sm text-muted-foreground sm:text-base">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"><Check className="size-3.5" /></span>{r}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1} className="glass rounded-2xl">
          <div className="border-b p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Job skills missing from {PROFILE.name}'s resume</p>
            <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Missing skill">
              {real.map((b) => <Pick key={b.skill} b={b} on={sel === b.skill} onClick={() => setSel(b.skill)} />)}
              <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
              <Pick b={probe} on={sel === probe.skill} onClick={() => setSel(probe.skill)} probe />
            </div>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={sel} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }} className="grid gap-5 p-5">
              <Verdicts c={c} />
              <Block label="In your profile">
                {c.source
                  ? <p className="rounded-xl border bg-muted/40 px-4 py-3 font-serif text-[15px] leading-relaxed">{highlight(c.source, c.evidence)}</p>
                  : <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                      {c.claimed.evidence.length ? `${c.claimed.evidence.join(" and ")} appear nowhere in the profile.` : `Nothing in the profile mentions ${c.skill}.`}
                    </p>}
              </Block>
              <Block label="In your documents">
                {c.outcome.before && c.outcome.after && (
                  <div className="mb-3 overflow-hidden rounded-xl border font-serif text-[15px] leading-relaxed">
                    <p className="flex gap-3 bg-danger/[0.07] px-4 py-2.5 text-muted-foreground"><Minus className="mt-1 size-3.5 shrink-0 text-danger" /><span>{c.outcome.before}</span></p>
                    <p className="flex gap-3 border-t bg-success/[0.08] px-4 py-2.5"><Plus className="mt-1 size-3.5 shrink-0 text-success" /><span>{highlight(c.outcome.after, [c.skill])}</span></p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">{c.outcome.note}</p>
              </Block>
            </motion.div>
          </AnimatePresence>
        </Reveal>
      </div>
    </Section>
  );
}

function Pick({ b, on, onClick, probe }: { b: BridgeCase; on: boolean; onClick: () => void; probe?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
        on ? "border-primary/60 bg-primary/15 text-foreground shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]" : "text-muted-foreground hover:border-primary/40 hover:text-foreground",
        probe && !on && "border-dashed")}>
      {probe && <FlaskConical className="size-3.5" />}{b.skill}{probe && <span className="text-xs font-normal opacity-80">· overclaim test</span>}
    </button>
  );
}

function Verdicts({ c }: { c: BridgeCase }) {
  const collapsed = c.claimed.verdict !== c.verdict;
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <div className="rounded-xl border bg-muted/30 p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Model says</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={c.claimed.verdict} className={cn(collapsed && "line-through opacity-70")} />
          {c.claimed.evidence.map((e) => (
            <code key={e} className={cn("rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs", collapsed && "text-danger line-through")}>{e}</code>
          ))}
        </div>
      </div>
      <ArrowRight className="mx-auto size-4 rotate-90 text-muted-foreground sm:rotate-0" aria-hidden />
      <div className={cn("rounded-xl border p-3.5", collapsed ? "border-danger/40 bg-danger/[0.06]" : "bg-muted/30")}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">After grounding</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={c.verdict} />
          {c.evidence.map((e) => <code key={e} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{e}</code>)}
        </div>
      </div>
      <p className="text-sm text-muted-foreground sm:col-span-3">{c.rationale}</p>
    </div>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function highlight(text: string, terms: string[]) {
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return text.split(re).map((part, i) => (i % 2
    ? <mark key={i} className="rounded bg-primary/20 px-0.5 font-sans text-[0.92em] font-semibold text-foreground">{part}</mark>
    : part));
}
