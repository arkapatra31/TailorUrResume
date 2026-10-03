import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { Reveal, Section, SectionHead } from "@/components/ui";
import { cn, REPO } from "@/lib/utils";

const MODULES = [
  { id: "parse", file: "profile/parse.py", llm: true, body: "Turns a PDF or DOCX into text, then into a structured, editable Profile. It never fills in approved skills; only you can." },
  { id: "fetch", file: "jd/fetchers.py", llm: false, body: "Fetches a posting from LinkedIn, Greenhouse, Lever or any page. Private and local addresses are refused, and nothing is cached." },
  { id: "extract", file: "jd/extract.py", llm: true, body: "Turns posting text into a JobDescription: title, must-haves, nice-to-haves, responsibilities and keywords." },
  { id: "match", file: "tailor/match.py", llm: true, body: "Scores keyword coverage (must-haves weigh 3) and blends it 55/45 with the model's semantic fit, plus gaps and next steps." },
  { id: "bridge", file: "tailor/bridge.py", llm: true, body: "Judges each missing skill supported, partial or unsupported, then re-grounds the verdict: evidence must literally appear in the profile." },
  { id: "generate", file: "tailor/generate.py", llm: true, body: "Builds the prompt from your profile, approved skills and match guidance, then streams token, bridge, warning and done events over SSE." },
  { id: "truth", file: "tailor/truth.py", llm: false, body: "Flags job terms, technologies, metrics, names, year claims, headers, dates and contact lines that are not traceable to your profile." },
  { id: "export", file: "export/", llm: false, body: "Renders the document to PDF with WeasyPrint or to DOCX, in memory, and streams it straight back. Classic, Modern or Compact." },
];

const NODES = [
  { k: "Browser", title: "React + Vite", body: "Six steps. All state in a Zustand store in memory. Session export leaves the key out." },
  { k: "Proxy", title: "Vite or nginx", body: "Forwards /api unbuffered, so streamed tokens arrive as they're generated." },
  { k: "FastAPI", title: "Stateless pipeline", body: "" },
  { k: "LLM", title: "Anthropic or Ollama", body: "A client built per request from the X-LLM-* headers. Ollama hosts are allow-listed." },
];
const LINKS = ["/api · X-LLM-*", "JSON · SSE", "per request"];

export function Architecture() {
  const [sel, setSel] = useState("generate");
  const m = MODULES.find((x) => x.id === sel)!;
  return (
    <Section id="architecture">
      <SectionHead eyebrow="Architecture" title="A thin pipe from your browser to your model."
        sub={<>State lives in the browser; the server only transforms it. Pick a module to see what it does, or read the <a className="text-primary underline-offset-4 hover:underline" href={`${REPO}#architecture`} target="_blank" rel="noopener">full component map</a>.</>} />
      <Reveal>
        <div className="grid items-stretch lg:grid-cols-[1fr_auto_1fr_auto_1.7fr_auto_1fr]">
          {NODES.map((n, i) => (
            <div key={n.k} className="contents">
              <div className={cn("glass rounded-2xl p-5", n.k === "FastAPI" && "border-primary/45 shadow-[0_0_60px_-20px_hsl(var(--primary)/0.6)]")}>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">{n.k}</p>
                <p className="mt-1 font-semibold">{n.title}</p>
                {n.body && <p className="mt-1.5 text-sm text-muted-foreground">{n.body}</p>}
                {n.k === "FastAPI" && (
                  <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Backend modules">
                    {MODULES.map((x) => (
                      <button key={x.id} type="button" aria-pressed={sel === x.id} onClick={() => setSel(x.id)}
                        className={cn("rounded-lg border px-2.5 py-1 font-mono text-xs transition",
                          sel === x.id ? "border-primary/60 bg-primary/15 text-foreground" : "bg-muted/50 text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                        {x.id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {i < LINKS.length && <Wire label={LINKS[i]} delay={i * 0.5} />}
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <div className="glass mx-auto mt-6 max-w-3xl rounded-2xl p-5" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
              <p className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-sm font-semibold text-primary">backend/app/{m.file}</code>
                <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", m.llm ? "border-primary/40 text-primary" : "text-muted-foreground")}>
                  {m.llm ? "calls the LLM" : "no LLM"}
                </span>
              </p>
              <p className="mt-2 text-muted-foreground">{m.body}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </Reveal>
    </Section>
  );
}

/** A connector with a packet travelling along it: horizontal on desktop, vertical when stacked. */
function Wire({ label, delay }: { label: string; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex min-h-14 items-center justify-center lg:min-h-0 lg:min-w-[104px]">
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-primary/60 to-transparent lg:inset-x-0 lg:inset-y-auto lg:left-0 lg:top-1/2 lg:h-px lg:w-auto lg:translate-x-0 lg:bg-gradient-to-r" />
      {!reduce && (
        <>
          <motion.span className="absolute left-1/2 top-0 hidden size-1.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))] max-lg:block"
            animate={{ top: ["0%", "100%"], opacity: [0, 1, 0] }} transition={{ duration: 1.6, repeat: Infinity, delay, ease: "easeInOut" }} />
          <motion.span className="absolute top-1/2 hidden size-1.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))] lg:block"
            animate={{ left: ["0%", "100%"], opacity: [0, 1, 0] }} transition={{ duration: 1.6, repeat: Infinity, delay, ease: "easeInOut" }} />
        </>
      )}
      <span className="relative whitespace-nowrap rounded-md border bg-background px-1.5 py-1 font-mono text-[10px] text-muted-foreground lg:absolute lg:bottom-1/2 lg:mb-2 lg:border-0 lg:bg-transparent lg:p-0">{label}</span>
    </div>
  );
}
