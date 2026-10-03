import { Ban, HardDrive, KeyRound, Lock, MonitorSmartphone, Save } from "lucide-react";
import { Reveal, Section, SectionHead } from "@/components/ui";

const INVENT = ["Employers", "Titles", "Dates", "Degrees", "Skills", "Tools", "Metrics", "Numbers"];

const KEPT = [
  { icon: HardDrive, title: "Your resume", body: "Parsed in memory, never written to disk. In Docker the API container runs read-only." },
  { icon: KeyRound, title: "Your API key", body: "Sent per request in a header, used for that request only, and redacted from logs." },
  { icon: MonitorSmartphone, title: "Your session", body: "No database, server sessions, cookies or localStorage. Refresh the tab and it's gone." },
  { icon: Save, title: "Unless you save it", body: "Download a session as JSON, without the key, and load it later to pick up where you left off." },
];

export function Privacy() {
  return (
    <Section id="privacy">
      <SectionHead eyebrow="Ground rules" title="Nothing invented. Nothing kept."
        sub="Two promises the code is built around, not settings you have to find." />
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal className="glass relative overflow-hidden rounded-2xl p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-danger/10 blur-3xl" aria-hidden />
          <span className="grid size-11 place-items-center rounded-xl border border-danger/30 bg-danger/10 text-danger"><Ban className="size-5" /></span>
          <h3 className="mt-5 text-xl font-bold">Built not to invent</h3>
          <p className="mt-2 text-muted-foreground">Every generation runs under one rule: use only facts present in your profile. The model may reorder, condense and rephrase. It may never invent:</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {INVENT.map((w) => (
              <li key={w} className="rounded-lg border px-3 py-1.5 text-sm font-medium text-muted-foreground line-through decoration-danger/70 decoration-2">{w}</li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-muted-foreground">If the job asks for something you lack, it simply isn't claimed, and the truth guard re-checks every draft.</p>
        </Reveal>
        <Reveal delay={0.08} className="glass relative overflow-hidden rounded-2xl p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/15 blur-3xl" aria-hidden />
          <span className="grid size-11 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary"><Lock className="size-5" /></span>
          <h3 className="mt-5 text-xl font-bold">Built not to keep</h3>
          <p className="mt-2 text-muted-foreground">The server is stateless: no database, no disk writes, no caches. Every request carries its own state.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {KEPT.map((k) => (
              <div key={k.title} className="rounded-xl border bg-muted/30 p-4">
                <p className="flex items-center gap-2 font-semibold"><k.icon className="size-4 text-primary" />{k.title}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">{k.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
      <Reveal delay={0.1}>
        <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-muted-foreground">
          Your resume and the job text go only to the LLM provider you choose. Run the app and Ollama on your own machine,
          and they never leave it.
        </p>
      </Reveal>
    </Section>
  );
}
