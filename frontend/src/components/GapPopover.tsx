import { motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AttestedSkill, BridgeItem, BridgeVerdict } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Label, Textarea } from "./ui/field";

export const VERDICT: Record<BridgeVerdict, { mark: string; short: string; label: string; cls: string }> = {
  supported: { mark: "✓", short: "backed", label: "Backed by your experience", cls: "text-success" },
  partial: { mark: "≈", short: "related", label: "Related experience only", cls: "text-warn" },
  unsupported: { mark: "?", short: "no evidence", label: "No evidence in your profile", cls: "text-muted-foreground" },
};

const W = 340, GAP = 8, EDGE = 16;

interface Props {
  skill: string;
  item?: BridgeItem;
  attested?: AttestedSkill;
  anchor: HTMLElement | null;
  onSave: (a: AttestedSkill | null) => void;
  onClose: () => void;
}

/** Include/exclude one missing job skill, with the evidence that backs it. */
export function GapPopover({ skill, item, attested, anchor, onSave, onClose }: Props) {
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null);
  const [include, setInclude] = useState(!!attested);
  const [evidence, setEvidence] = useState(attested?.evidence ?? item?.evidence.join(", ") ?? "");
  const ref = useRef<HTMLDivElement>(null);
  const verdict = item?.verdict ?? "unsupported";
  // Anything the bridge did not mark supported is the user's own word: they must say what backs it.
  const selfAttested = verdict !== "supported";
  const needsEvidence = include && selfAttested && !evidence.trim();

  // Fixed position from the chip, clamped to the viewport and flipped above when there is no room below.
  useLayoutEffect(() => {
    const place = () => {
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const w = Math.min(W, window.innerWidth - 2 * EDGE);
      const h = ref.current?.offsetHeight ?? 360;
      const left = Math.min(Math.max(EDGE, r.left), window.innerWidth - w - EDGE);
      const below = window.innerHeight - r.bottom - GAP - EDGE;
      const above = r.top - GAP - EDGE;
      const top = below >= h || below >= above ? r.bottom + GAP : Math.max(EDGE, r.top - GAP - h);
      setPos({ left, top, maxH: Math.max(below, above) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [anchor, include]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const click = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor?.contains(t)) return; // the chip toggles itself
      onClose();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("mousedown", click);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", click); };
  }, [onClose, anchor]);

  const save = () => {
    onSave(include ? { skill, evidence: evidence.trim(), self_attested: selfAttested } : null);
    onClose();
  };

  return createPortal(
    <motion.div ref={ref} role="dialog" aria-label={`Bridge ${skill}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, width: `min(${W}px, calc(100vw - ${2 * EDGE}px))`, maxHeight: pos?.maxH }}
      className="fixed z-50 space-y-3 overflow-y-auto rounded-xl border bg-background p-4 text-sm text-foreground shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="break-words font-semibold">{skill}</div>
          {item && <div className={cn("text-xs", VERDICT[verdict].cls)}>{VERDICT[verdict].mark} {VERDICT[verdict].label}</div>}
        </div>
        <button onClick={onClose} aria-label="Close" className="shrink-0 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
      </div>
      {item?.rationale && <p className="text-muted-foreground">{item.rationale}</p>}

      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" checked={include} onChange={(e) => setInclude(e.target.checked)} className="size-4 accent-primary" />
        Include in my documents
      </label>
      {include && (
        <p className="text-xs text-muted-foreground">
          In Craft, the related wording in your resume is rephrased to this job term (e.g. "LLM apps" becomes "Gen AI apps"). No new achievements are added.
        </p>
      )}

      <div>
        <Label htmlFor={`ev-${skill}`}>Evidence from your experience</Label>
        <Textarea id={`ev-${skill}`} rows={3} className="min-h-[72px] text-sm" value={evidence} onChange={(e) => setEvidence(e.target.value)}
          placeholder="e.g. Built RAG chatbots with LangChain and the Claude SDK" />
      </div>

      {include && selfAttested && (
        <p className="flex gap-2 rounded-lg border border-warn/40 bg-warn/10 p-2 text-xs">
          <AlertTriangle className="size-4 shrink-0 text-warn" />
          Only include this if you genuinely have the skill. It will be marked as self-attested, so be ready to back it up in an interview.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={save} disabled={needsEvidence} title={needsEvidence ? "Describe the experience that backs this skill" : undefined}>Save</Button>
      </div>
    </motion.div>,
    document.body,
  );
}
