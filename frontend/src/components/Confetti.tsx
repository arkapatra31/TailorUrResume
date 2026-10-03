import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

const COLORS = ["#a78bfa", "#22d3ee", "#f472b6", "#34d399", "#fbbf24", "#60a5fa"];

export function Confetti({ fire }: { fire: boolean }) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!fire || reduce) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 3800);
    return () => clearTimeout(t);
  }, [fire, reduce]);
  const bits = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        id: i, x: (Math.random() - 0.5) * 900, y: -(200 + Math.random() * 380), r: Math.random() * 720 - 360,
        c: COLORS[i % COLORS.length], w: 6 + Math.random() * 6, d: 1.8 + Math.random() * 1.4, delay: Math.random() * 0.2,
      })),
    [],
  );
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" aria-hidden="true">
      {bits.map((b) => (
        <motion.span
          key={b.id}
          initial={{ x: 0, y: 40, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ x: b.x, y: [b.y, b.y + 700], opacity: [1, 1, 0], rotate: b.r }}
          transition={{ duration: b.d, delay: b.delay, ease: "easeOut" }}
          style={{ position: "absolute", width: b.w, height: b.w * 0.5, background: b.c, borderRadius: 2 }}
        />
      ))}
    </div>
  );
}
