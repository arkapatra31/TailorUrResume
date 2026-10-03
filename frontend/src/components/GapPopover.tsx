import { motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AttestedSkill, BridgeItem, BridgeVerdict } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Label, Textarea } from "./ui/field";

export const VERDICT: Record<BridgeVerdict, { mark: string; label: string; cls: string }> = {
  supported: { mark: "✓", label: "Supported by your profile", cls: "text-success" },
  partial: { mark: "~", label: "Related experience only", cls: "text-warn" },
  unsupported: { mark: "✕", label: "No support found in your profile", cls: "text-danger" },
};

interface Props {
  skill: string;
  item?: BridgeItem;
  attested?: AttestedSkill;
  onSave: (a: AttestedSkill | null) => void;
  onClose: () => void;
}

/** Include/exclude one missing job skill, with the evidence that backs it. */
export function GapPopover({ skill, item, attested, onSave, onClose }: Props) {
  const [include, setInclude] = useState(!!attested);
  const [evidence, setEvidence] = useState(attested?.evidence ?? item?.evidence.join(", ") ?? "");
  const ref = useRef<HTMLDivElement>(null);
  const verdict = item?.verdict ?? "unsupported";
  // Anything the bridge did not mark supported is the user's own word: they must say what backs it.
  const selfAttested = verdict !== "supported";
  const needsEvidence = include && selfAttested && !evidence.trim();

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const click = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    document.addEventListener("keydown", key);
    document.addEventListener("mousedown", click);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", click); };
  }, [onClose]);

  const save = () => {
    onSave(include ? { skill, evidence: evidence.trim(), self_attested: selfAttested } : null);
    onClose();
  };

  return (
    <motion.div ref={ref} role="dialog" aria-label={`Bridge ${skill}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      className="absolute left-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border bg-background p-4 text-sm text-foreground shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{skill}</div>
          {item && <div className={cn("text-xs", VERDICT[verdict].cls)}>{VERDICT[verdict].mark} {VERDICT[verdict].label}</div>}
        </div>
        <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
      </div>
      {item?.rationale && <p className="text-muted-foreground">{item.rationale}</p>}

      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" checked={include} onChange={(e) => setInclude(e.target.checked)} className="size-4 accent-primary" />
        Include in my documents
      </label>

      <div>
        <Label htmlFor={`ev-${skill}`}>Evidence from your experience</Label>
        <Textarea id={`ev-${skill}`} rows={2} className="min-h-[60px]" value={evidence} onChange={(e) => setEvidence(e.target.value)}
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
    </motion.div>
  );
}
