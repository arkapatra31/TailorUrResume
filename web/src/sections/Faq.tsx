import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Reveal, Section, SectionHead } from "@/components/ui";
import { cn } from "@/lib/utils";

const QA: [string, ReactNode][] = [
  ["Is it free?", "The app is free and open source under Apache-2.0. You pay your LLM provider for what you use, or nothing at all with a local Ollama model."],
  ["Is there a hosted version?", "No. This site only describes the project. You run the app yourself with Docker or locally, so your resume only goes where you send it."],
  ["Where does my data go?", "Your browser sends each request to your own TailorUrResume backend, which passes the resume and job text to the provider you picked. The backend keeps nothing: no database, no disk writes, no caches, and your key is redacted from logs."],
  ["Can it still make things up?", "The prompts forbid inventing employers, titles, dates, degrees, skills, tools, metrics or numbers, and the truth guard flags anything it can't trace to your profile. The guard is heuristic, though, so read the result before you send it."],
  ["What does a “supported” skill mean?", "The bridge decided that experience already in your profile genuinely demonstrates the skill, for example PostgreSQL for SQL, and the evidence was found word for word in your profile. Partial means related but not the same, like Docker for Kubernetes."],
  ["Which files can I upload?", "PDF and DOCX, up to 5 MB by default (configurable with MAX_UPLOAD_BYTES). Scanned, image-only PDFs aren't supported yet."],
  ["Is fetching LinkedIn postings allowed?", "The app uses LinkedIn's public guest endpoint, which is unofficial and may be blocked. It fetches one posting only when you click Fetch, and caches nothing. Automated or bulk scraping violates LinkedIn's terms, so if in doubt, paste the text instead."],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq">
      <SectionHead eyebrow="FAQ" title="Questions, answered." />
      <Reveal className="mx-auto grid max-w-3xl gap-3">
        {QA.map(([q, a], i) => {
          const on = open === i;
          return (
            <div key={q} className={cn("glass rounded-2xl transition-colors", on && "border-primary/35")}>
              <h3>
                <button type="button" aria-expanded={on} aria-controls={`faq-${i}`} id={`faq-q-${i}`} onClick={() => setOpen(on ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold">
                  {q}
                  <Plus className={cn("size-5 shrink-0 text-primary transition-transform duration-300", on && "rotate-45")} />
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {on && (
                  <motion.div id={`faq-${i}`} role="region" aria-labelledby={`faq-q-${i}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }} className="overflow-hidden">
                    <p className="px-5 pb-5 text-muted-foreground">{a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </Reveal>
    </Section>
  );
}
