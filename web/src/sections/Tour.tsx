import { AnimatePresence, animate, motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { FileDown, FileText, Gauge, KeyRound, Link2, PenLine } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BrowserFrame, Reveal, Section, SectionHead } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { asset, cn } from "@/lib/utils";

const STEPS = [
  { id: "key", label: "Key", icon: KeyRound, title: "Bring your own brain", ep: "POST /api/test-connection",
    body: "Pick Anthropic or a local Ollama model and test the connection. Your key stays in this tab's memory and travels per request in the X-LLM-Key header. It is never stored." },
  { id: "profile", label: "Profile", icon: FileText, title: "Your story, structured", ep: "POST /api/profile/parse",
    body: "Drop a PDF or DOCX. It is parsed in memory into an editable profile of contact details, experience, education and skills." },
  { id: "job", label: "Job", icon: Link2, title: "Pick your target", ep: "POST /api/jd/fetch · /api/jd/extract",
    body: "Paste a posting, or fetch it from LinkedIn, Greenhouse, Lever or any careers page. The model pulls out must-haves, nice-to-haves and keywords." },
  { id: "match", label: "Match", icon: Gauge, title: "How well do you fit?", ep: "POST /api/match · /api/bridge",
    body: "Keyword coverage (must-haves count three times) blended 55/45 with semantic fit. Bridge gaps to add skills your experience already proves." },
  { id: "craft", label: "Craft", icon: PenLine, title: "Craft your documents", ep: "POST /api/generate (SSE)",
    body: "A resume, CV or cover letter, streamed live and editable in place. Rewrite any bullet, compare with your original, and see every unverified claim." },
  { id: "export", label: "Export", icon: FileDown, title: "Ship it", ep: "POST /api/export/{pdf,docx}",
    body: "Choose Classic, Modern or Compact. Download a PDF with selectable text for ATS parsers, or an editable DOCX." },
] as const;
const DWELL = 6500;
const shot = (id: string, theme: string) => asset(`shots/${id}-${theme}.webp`);

export function Stats() {
  const items = [
    { n: 6, label: "steps from posting to PDF" },
    { n: 3, label: "documents: resume, CV, cover letter" },
    { n: 3, label: "ATS-friendly templates" },
    { n: 0, label: "bytes of your data stored" },
  ];
  return (
    <div className="wrap">
      <Reveal className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-4">
        {items.map((s) => (
          <div key={s.label} className="bg-background/85 px-5 py-6 text-center backdrop-blur">
            <CountUp to={s.n} className="text-4xl font-extrabold tracking-tight text-gradient" />
            <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </Reveal>
    </div>
  );
}

function CountUp({ to, className }: { to: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [v, setV] = useState(to === 0 ? 100 : 0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) { setV(to); return; }
    // Zero counts down from 100: the point is that nothing is kept.
    const c = animate(to === 0 ? 100 : 0, to, { duration: to === 0 ? 1.6 : 1, ease: [0.2, 0.8, 0.2, 1], onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, to, reduce]);
  return <span ref={ref} className={cn("tabular-nums", className)}>{v}</span>;
}

export function Tour() {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hover, setHover] = useState(false);
  const running = auto && inView && !hover && !reduce;
  const step = STEPS[i];

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.25"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 16, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0.94, 1]);

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setI((x) => (x + 1) % STEPS.length), DWELL);
    return () => clearTimeout(t);
  }, [i, running]);

  useEffect(() => {
    if (!inView) return;
    STEPS.forEach((s) => { new Image().src = shot(s.id, theme); });
  }, [inView, theme]);

  const pick = (n: number) => { setAuto(false); setI(n); };
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    const n = (i + d + STEPS.length) % STEPS.length;
    pick(n);
    document.getElementById(`tour-tab-${STEPS[n].id}`)?.focus();
  };

  return (
    <Section id="tour">
      <SectionHead eyebrow="Product tour" title="Six steps from posting to PDF."
        sub="Real screens from the app. Each step is one stateless API call, and your browser holds all the state." />
      <div ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <div role="tablist" aria-label="App steps" onKeyDown={onKey} className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {STEPS.map((s, n) => (
            <button key={s.id} id={`tour-tab-${s.id}`} role="tab" aria-selected={n === i} aria-controls="tour-panel" tabIndex={n === i ? 0 : -1}
              onClick={() => pick(n)}
              className={cn("group relative overflow-hidden rounded-xl border px-3 py-3 text-left transition-colors",
                n === i ? "glass glass-strong border-primary/40" : "border-transparent hover:bg-[hsl(var(--glass))]")}>
              <span className="flex items-center gap-2">
                <s.icon className={cn("size-4 shrink-0", n === i ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                <span className={cn("text-sm font-semibold", n === i ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>{s.label}</span>
                <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground/80 lg:inline">0{n + 1}</span>
              </span>
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-transparent">
                {n === i && (running
                  ? <motion.span key={`${i}-${running}`} className="block h-full bg-primary" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: DWELL / 1000, ease: "linear" }} />
                  : <span className="block h-full w-full bg-primary" />)}
              </span>
            </button>
          ))}
        </div>

        <div style={{ perspective: 1600 }}>
          <motion.div style={{ rotateX, scale, transformOrigin: "50% 0%" }}>
            <BrowserFrame className="shadow-[0_40px_120px_-40px_hsl(var(--primary)/0.45)]">
              <div id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${step.id}`} className="relative aspect-[16/10] bg-background">
                <AnimatePresence initial={false}>
                  <motion.img key={`${step.id}-${theme}`} src={shot(step.id, theme)} alt={`The ${step.label} step of the TailorUrResume app`}
                    width={2160} height={1350} loading="lazy" decoding="async"
                    initial={{ opacity: 0, scale: 1.01 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}
                    className="absolute inset-0 size-full object-cover object-top" />
                </AnimatePresence>
              </div>
            </BrowserFrame>
          </motion.div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}
            className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-8">
            <div>
              <h3 className="text-xl font-bold">{step.title}</h3>
              <p className="mt-1.5 max-w-3xl text-muted-foreground">{step.body}</p>
            </div>
            <code className="justify-self-start rounded-lg border bg-muted/60 px-2.5 py-1.5 font-mono text-xs text-muted-foreground">{step.ep}</code>
          </motion.div>
        </AnimatePresence>
      </div>
    </Section>
  );
}
