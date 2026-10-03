import { motion, useReducedMotion } from "framer-motion";
import { Command, Cpu, FileDown, GitCompare, Layers, Link2, PenLine, Radio, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal, Section, SectionHead } from "@/components/ui";
import { cn } from "@/lib/utils";

export function Features() {
  return (
    <Section id="features">
      <SectionHead eyebrow="Also included" title="The details that make it quick to use." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Tile className="lg:col-span-2" icon={Radio} title="Streamed, editable drafts" delay={0}
          body="Watch the draft arrive over server-sent events and stop it any time. Click any line to edit it, or rewrite one bullet with an instruction.">
          <SseLog />
        </Tile>
        <Tile icon={GitCompare} title="Original vs tailored" delay={0.05} body="See exactly what changed from the resume you uploaded.">
          <div className="overflow-hidden rounded-xl border font-serif text-[13px] leading-relaxed">
            <p className="bg-danger/[0.07] px-3 py-2 text-muted-foreground"><span className="mr-2 font-sans text-danger">−</span>Built <span className="bg-danger/15 line-through">LLM</span> apps with LangChain…</p>
            <p className="border-t bg-success/[0.08] px-3 py-2"><span className="mr-2 font-sans text-success">+</span>Built <span className="bg-success/20">Gen AI</span> apps with LangChain…</p>
          </div>
        </Tile>
        <Tile icon={FileDown} title="Three ATS templates" delay={0} body="Classic, Modern and Compact. PDF with selectable text via WeasyPrint, or editable DOCX.">
          <div className="flex justify-center gap-3">
            {(["classic", "modern", "compact"] as const).map((t) => <Paper key={t} kind={t} />)}
          </div>
        </Tile>
        <Tile icon={Link2} title="Fetch jobs by URL" delay={0.05} body="One URL per click, nothing cached. Private and local addresses are refused.">
          <div className="flex flex-wrap gap-2">
            {["LinkedIn", "Greenhouse", "Lever", "Any careers page"].map((s, i) => (
              <span key={s} className={cn("rounded-lg border px-2.5 py-1 text-xs font-medium", i === 3 ? "border-dashed text-muted-foreground" : "bg-muted/50")}>{s}</span>
            ))}
          </div>
        </Tile>
        <Tile icon={Layers} title="Many jobs, one session" delay={0.1} body="Tailor for several postings and compare how well you fit each.">
          <ScoreBars />
        </Tile>
        <Tile icon={Command} title="Command palette" delay={0} body="Jump between steps, generate documents and download, all from the keyboard.">
          <div className="rounded-xl border bg-background/60 p-2 text-xs">
            <p className="flex items-center justify-between border-b px-2 pb-2 text-muted-foreground">Type a command… <span className="kbd">⌘K</span></p>
            {[[Sparkles, "Generate tailored resume"], [PenLine, "Generate cover letter"], [FileDown, "Download PDF"]].map(([Icon, label], i) => {
              const I = Icon as typeof Sparkles;
              return <p key={label as string} className={cn("mt-1 flex items-center gap-2 rounded-md px-2 py-1.5", i === 0 && "bg-primary/15 text-foreground")}><I className="size-3.5 text-primary" />{label as string}</p>;
            })}
          </div>
        </Tile>
        <Tile className="lg:col-span-2" icon={Cpu} title="Your model, your choice" delay={0.05}
          body="Switch providers per session. Requests carry the provider, model and key in headers; the server builds a client per request.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="font-semibold">Anthropic</p>
              <p className="mt-1 text-sm text-muted-foreground">Your API key. The default model is configurable with <code className="font-mono text-xs">DEFAULT_ANTHROPIC_MODEL</code> or in the app.</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="font-semibold">Ollama</p>
              <p className="mt-1 text-sm text-muted-foreground">Any model you've pulled, such as llama3.1. Hosts are allow-listed with <code className="font-mono text-xs">ALLOWED_OLLAMA_HOSTS</code>.</p>
            </div>
          </div>
        </Tile>
      </div>
    </Section>
  );
}

function Tile({ icon: Icon, title, body, children, className, delay }: { icon: typeof Radio; title: string; body: string; children: ReactNode; className?: string; delay: number }) {
  return (
    <Reveal delay={delay} className={cn("glass group flex min-w-0 flex-col gap-5 rounded-2xl p-6 transition-colors hover:border-primary/35", className)}>
      <div>
        <p className="flex items-center gap-2.5 font-semibold"><Icon className="size-[18px] text-primary" />{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </Reveal>
  );
}

const EVENTS = [
  ["bridge", '{"items": […], "added": […]}'],
  ["token", '"## Experience\\n"'],
  ["token", '"Built Gen AI apps with LangChain…"'],
  ["token", '"Designed FastAPI services…"'],
  ["done", '{"doc": {…}, "flags": []}'],
];
function SseLog() {
  const reduce = useReducedMotion();
  return (
    <div className="overflow-hidden rounded-xl border bg-slate-950 p-4 font-mono text-[12px] leading-6 text-slate-300">
      <p className="text-slate-500">POST /api/generate  ·  text/event-stream</p>
      {EVENTS.map(([ev, data], i) => (
        <motion.p key={i} className="truncate" initial={reduce ? false : { opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }} transition={{ delay: 0.25 + i * 0.35, duration: 0.3 }}>
          <span className={ev === "done" ? "text-emerald-300" : ev === "bridge" ? "text-cyan-300" : "text-emerald-400/80"}>event: {ev.padEnd(6)}</span>
          <span className="text-slate-400"> data: </span>{data}
        </motion.p>
      ))}
    </div>
  );
}

function Paper({ kind }: { kind: "classic" | "modern" | "compact" }) {
  const line = (w: string, k?: string) => <span className={cn("block h-[3px] rounded-full bg-slate-300", k)} style={{ width: w }} />;
  return (
    <figure className="text-center">
      <div className={cn("h-28 w-20 rounded-md bg-white p-2 shadow-md ring-1 ring-black/5 transition-transform duration-300 group-hover:-translate-y-1",
        kind === "compact" ? "space-y-[3px]" : "space-y-1")}>
        {kind === "classic" && <span className="mx-auto block h-1.5 w-10 rounded-full bg-slate-700" />}
        {kind === "modern" && <span className="block h-1.5 w-10 rounded-full bg-sky-700" />}
        {kind === "compact" && <span className="block h-1.5 w-9 rounded-full bg-slate-700" />}
        {line("70%", kind === "classic" ? "mx-auto" : "")}
        <span className={cn("block h-px", kind === "modern" ? "bg-sky-700" : "bg-slate-500")} />
        {line("90%")}{line("80%")}{line("86%")}
        <span className={cn("block h-px", kind === "modern" ? "bg-sky-700" : "bg-slate-500")} />
        {line("76%")}{line("88%")}{kind === "compact" && <>{line("82%")}{line("70%")}{line("90%")}</>}
      </div>
      <figcaption className="mt-2 text-xs capitalize text-muted-foreground">{kind}</figcaption>
    </figure>
  );
}

function ScoreBars() {
  const jobs = [["Northwind Labs", 83], ["Acme Corp", 72], ["Globex", 58]] as const;
  return (
    <div className="grid gap-2.5">
      {jobs.map(([name, s], i) => (
        <div key={name} className="grid grid-cols-[96px_1fr_28px] items-center gap-2 text-xs">
          <span className="truncate text-muted-foreground">{name}</span>
          <span className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.span className="block h-full rounded-full bg-gradient-to-r from-primary to-accent" initial={{ width: 0 }} whileInView={{ width: `${s}%` }}
              viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.12, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} />
          </span>
          <span className="text-right font-semibold tabular-nums">{s}</span>
        </div>
      ))}
    </div>
  );
}
