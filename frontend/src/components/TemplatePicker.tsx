import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { Check } from "lucide-react";
import type { Doc, TemplateId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PaperDoc } from "./PaperDoc";

const TEMPLATES: { id: TemplateId; name: string; blurb: string }[] = [
  { id: "classic", name: "Classic", blurb: "Serif, centered header. Safe everywhere." },
  { id: "modern", name: "Modern", blurb: "Clean sans with a blue accent." },
  { id: "compact", name: "Compact", blurb: "Dense, fits more on one page." },
];

function Tilt({ children, active, onClick, label }: { children: React.ReactNode; active: boolean; onClick: () => void; label: string }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [12, -12]), { stiffness: 200, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-14, 14]), { stiffness: 200, damping: 18 });
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`Use ${label} template`}
      onClick={onClick}
      onMouseMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
      className="[perspective:900px] text-left"
    >
      <motion.div style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }} whileHover={reduce ? undefined : { scale: 1.04 }}
        className={cn("relative rounded-md ring-offset-2 ring-offset-background transition-shadow", active ? "ring-2 ring-primary shadow-[0_0_40px_-4px_hsl(var(--primary)/0.8)]" : "ring-0")}>
        {children}
        {active && (
          <span className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Check className="size-4" />
          </span>
        )}
      </motion.div>
    </button>
  );
}

export function TemplatePicker({ doc, value, onChange }: { doc: Doc; value: TemplateId; onChange: (t: TemplateId) => void }) {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {TEMPLATES.map((t) => (
        <div key={t.id}>
          <Tilt active={value === t.id} onClick={() => onChange(t.id)} label={t.name}>
            <div className="pointer-events-none"><PaperDoc doc={doc} template={t.id} fontSize={3.6} /></div>
          </Tilt>
          <div className="mt-3 px-1">
            <div className="font-semibold">{t.name}</div>
            <div className="text-sm text-muted-foreground">{t.blurb}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
