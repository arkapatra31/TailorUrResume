import { motion } from "framer-motion";
import { useState, type KeyboardEvent } from "react";
import { CopyButton, Reveal, Section, SectionHead } from "@/components/ui";
import { cn, REPO } from "@/lib/utils";

const TABS = [
  {
    id: "docker", label: "Docker", open: "http://localhost:3000",
    code: [
      "# UI on :3000, API on :8000",
      `git clone ${REPO}.git`,
      "cd TailorUrResume",
      "docker compose up --build",
    ],
  },
  {
    id: "local", label: "Local", open: "http://localhost:5173",
    code: [
      "# backend (Python 3.11+)",
      "cd backend",
      "python -m venv .venv && source .venv/bin/activate",
      "pip install -r requirements.txt -r requirements-dev.txt",
      "uvicorn app.main:app --reload --port 8000",
      "",
      "# frontend, in a second terminal",
      "cd frontend && npm install && npm run dev",
    ],
  },
  {
    id: "ollama", label: "With Ollama", open: "http://localhost:3000",
    code: [
      "# also start a local Ollama, then pull a model",
      "docker compose --profile ollama up --build",
      "docker compose exec ollama ollama pull llama3.1",
      "",
      "# in the app, pick \"Ollama (local)\" and that model",
    ],
  },
];

export function GetStarted() {
  const [tab, setTab] = useState(0);
  const t = TABS[tab];
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    const n = (tab + d + TABS.length) % TABS.length;
    setTab(n);
    document.getElementById(`start-tab-${TABS[n].id}`)?.focus();
  };
  const steps = [
    `Open ${t.open.replace("http://", "")}`,
    tab === 2 ? "Choose Ollama (local) and your model" : "Paste your Anthropic key, or choose Ollama",
    "Drop your resume, add a job, and tailor",
  ];

  return (
    <Section id="start">
      <SectionHead eyebrow="Get started" title="Running in about a minute."
        sub="There's no hosted version, by design. You run it, so your resume goes nowhere you didn't choose." />
      <Reveal className="mx-auto max-w-3xl">
        <div className="glass overflow-hidden rounded-2xl">
          <div role="tablist" aria-label="Install method" onKeyDown={onKey} className="flex gap-1 border-b p-2">
            {TABS.map((x, i) => (
              <button key={x.id} id={`start-tab-${x.id}`} role="tab" aria-selected={i === tab} aria-controls="start-panel" tabIndex={i === tab ? 0 : -1}
                onClick={() => setTab(i)} className={cn("relative rounded-lg px-4 py-2 text-sm font-semibold transition-colors", i === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {i === tab && <motion.span layoutId="start-pill" className="absolute inset-0 -z-10 rounded-lg bg-[hsl(var(--glass-strong))] ring-1 ring-border" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                {x.label}
              </button>
            ))}
          </div>
          <div id="start-panel" role="tabpanel" aria-labelledby={`start-tab-${t.id}`} className="relative bg-slate-950">
            <CopyButton text={t.code.filter((l) => l && !l.startsWith("#")).join("\n")} className="absolute right-3 top-3" />
            <pre className="overflow-x-auto px-5 py-5 pr-24 font-mono text-[13px] leading-7 text-slate-200 sm:px-6">
              {t.code.map((l, i) => (
                <div key={i} className={l.startsWith("#") ? "text-slate-500" : ""}>
                  {l && !l.startsWith("#") && <span className="mr-3 select-none text-emerald-400/70">$</span>}{l || " "}
                </div>
              ))}
            </pre>
          </div>
        </div>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s} className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{i + 1}</span>{s}
            </li>
          ))}
        </ol>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          PDF export needs Pango (<code className="font-mono">brew install pango</code> on macOS). Without it, DOCX export still works.
        </p>
      </Reveal>
    </Section>
  );
}
