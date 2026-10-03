import { animate, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

export function scoreTone(score: number) {
  if (score >= 85) return "hsl(var(--success))";
  if (score >= 65) return "hsl(var(--accent))";
  if (score >= 45) return "hsl(var(--warn))";
  return "hsl(var(--danger))";
}

export function ScoreGauge({ score, size = 220, label = "ATS match" }: { score: number; size?: number; label?: string }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? score : 0);
  useEffect(() => {
    if (reduce) { setN(score); return; }
    const c = animate(0, score, { duration: 1.6, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [score, reduce]);
  const r = size / 2 - 14, circ = 2 * Math.PI * r;
  const color = scoreTone(score);
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${score} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
        {/* Soft glow as a wider translucent stroke: a CSS drop-shadow filter on the circle renders as a square box. */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="22" strokeLinecap="round" opacity={0.18}
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - score / 100) }}
          transition={{ duration: reduce ? 0 : 1.6, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - score / 100) }}
          transition={{ duration: reduce ? 0 : 1.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold tabular-nums" style={{ color }}>{n}</span>
        <span className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
