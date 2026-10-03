import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ShieldAlert, ShieldCheck } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { Reveal, Section } from "@/components/ui";
import { ATTESTED, guardProfile, JD_TERMS, PROFILE } from "@/lib/demo";
import { checkText, type Flag } from "@/lib/truth";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "Honest rewrite", text: "Built Gen AI apps with LangChain and the Claude SDK used by 3 internal teams." },
  { label: "Inflated metric", text: "Cut model-serving latency by 60% across 12 production services." },
  { label: "Borrowed tech", text: "Deployed RAG services on Kubernetes and AWS, provisioned with Terraform." },
  { label: "Stretched tenure", text: "Senior engineer with 10+ years of Python experience." },
  { label: "Name-drop", text: "Partnered with Google on retrieval research at Brightline Analytics." },
];

const CHECKS = [
  ["Job keywords and technologies", "you never listed, like Kubernetes when only Docker is in your profile"],
  ["Numbers and metrics", "that appear nowhere in your profile, like a latency cut you never measured"],
  ["“N years” claims", "longer than your dated experience supports"],
  ["Names, titles and dates", "that don't match a company, school or role you actually had"],
  ["Contact lines", "that differ from the details you gave"],
];

export function Truth() {
  const [text, setText] = useState(PRESETS[1].text);
  const [approved, setApproved] = useState(true);
  const id = useId();
  const flags = useMemo(() => checkText(text, guardProfile(approved), JD_TERMS), [text, approved]);

  return (
    <Section id="truth">
      <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
        <Reveal className="order-2 lg:order-1">
          <div className="glass rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
              <div>
                <p className="font-semibold">Truth guard playground</p>
                <p className="text-sm text-muted-foreground">Checked against {PROFILE.name}'s profile, live in your browser</p>
              </div>
              <button type="button" role="switch" aria-checked={approved} onClick={() => setApproved(!approved)} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <span className={cn("relative h-6 w-10 rounded-full border transition-colors", approved ? "border-primary/60 bg-primary/80" : "bg-muted")}>
                  <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    className={cn("absolute top-0.5 size-[18px] rounded-full bg-white shadow", approved ? "right-0.5" : "left-0.5")} />
                </span>
                Approved skills ({ATTESTED.map((a) => a.skill).join(", ")})
              </button>
            </div>

            <div className="grid gap-4 p-5">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Examples">
                {PRESETS.map((p) => (
                  <button key={p.label} type="button" aria-pressed={text === p.text} onClick={() => setText(p.text)}
                    className={cn("rounded-full border px-3 py-1 text-xs font-medium transition sm:text-sm",
                      text === p.text ? "border-primary/60 bg-primary/15 text-foreground" : "text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div>
                <label htmlFor={id} className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Write a resume bullet</label>
                <textarea id={id} value={text} onChange={(e) => setText(e.target.value.slice(0, 280))} rows={2} spellCheck={false}
                  className="w-full resize-none rounded-xl border bg-background/60 px-4 py-3 text-[15px] leading-relaxed outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/15" />
              </div>

              <div aria-live="polite">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">What the guard sees</p>
                <div className="rounded-xl border bg-white px-4 py-3.5 font-serif text-[15px] leading-relaxed text-slate-900 shadow-sm">
                  {text.trim() ? <Highlighted text={text} flags={flags} /> : <span className="text-slate-500">Type something to check.</span>}
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  {flags.length === 0 ? (
                    <motion.p key="ok" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-3 flex items-center gap-2 text-sm font-medium text-success">
                      <ShieldCheck className="size-4" /> Nothing to flag. Every claim traces back to the profile.
                    </motion.p>
                  ) : (
                    <motion.ul key={flags.map((f) => f.term).join()} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 grid gap-2">
                      <li className="flex items-center gap-2 text-sm font-semibold text-danger">
                        <ShieldAlert className="size-4" /> {flags.length} unverified {flags.length === 1 ? "claim" : "claims"}
                      </li>
                      {flags.map((f) => (
                        <li key={f.term + f.start} className="flex flex-wrap items-center gap-2 text-sm">
                          <code className="rounded-md border border-danger/40 bg-danger/10 px-1.5 py-0.5 font-mono text-xs text-foreground">{f.term}</code>
                          <span className="text-muted-foreground">{f.reason}</span>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>

              <details className="group rounded-xl border bg-muted/30 px-4 py-3 text-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  The profile it checks against
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3 grid gap-3 text-muted-foreground">
                  {PROFILE.experience.map((e) => (
                    <div key={e.company}>
                      <p className="font-semibold text-foreground">{e.title} · {e.company} <span className="font-normal text-muted-foreground">({e.start} to {e.end})</span></p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">{e.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                    </div>
                  ))}
                  <p><span className="font-semibold text-foreground">Skills:</span> {PROFILE.skills.join(", ")}</p>
                  {approved && <p><span className="font-semibold text-foreground">Approved:</span> {ATTESTED.map((a) => `${a.skill} (from ${a.evidence})`).join(", ")}</p>}
                </div>
              </details>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            A simplified port of <code className="font-mono">tailor/truth.py</code> covering keywords, years, numbers, technologies and names.
            The real guard also checks headers, dates and contact lines.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="order-1 lg:sticky lg:top-28 lg:order-2">
          <p className="eyebrow">Truthfulness guard</p>
          <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-[2.6rem] sm:leading-[1.1]">Try to sneak something past it.</h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            After every draft, the guard flags anything it can't trace back to your profile, so you can fix it before you send it.
          </p>
          <ul className="mt-7 grid gap-4">
            {CHECKS.map(([t, d]) => (
              <li key={t} className="border-l-2 border-primary/50 pl-4">
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            Skills you approve on the Match step count as facts. If you vouch for one without evidence in your profile, it is marked
            self-attested and shown separately. The guard is heuristic, so read the result before you send it.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}

function Highlighted({ text, flags }: { text: string; flags: Flag[] }) {
  const out: ReactNode[] = [];
  let at = 0;
  flags.forEach((f, i) => {
    if (f.start < at) return;
    out.push(text.slice(at, f.start));
    out.push(
      <motion.mark key={`${f.start}-${i}`} initial={{ backgroundColor: "rgba(225,29,72,0)" }} animate={{ backgroundColor: "rgba(225,29,72,0.14)" }}
        title={f.reason} className="rounded px-0.5 text-rose-900 shadow-[inset_0_-2px_0_#e11d48]">
        {text.slice(f.start, f.end)}
      </motion.mark>,
    );
    at = f.end;
  });
  out.push(text.slice(at));
  return <>{out}</>;
}
