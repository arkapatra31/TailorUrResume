import { X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function TagInput({ value, onChange, placeholder, tone = "neutral" }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string; tone?: "neutral" | "primary";
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const parts = draft.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))]);
    setDraft("");
  };
  return (
    <div className="field flex min-h-[42px] flex-wrap items-center gap-1.5 !p-1.5">
      {value.map((t, i) => (
        <span key={t + i} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs", tone === "primary" ? "bg-primary/20 border-primary/50" : "bg-muted")}>
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-full hover:text-danger">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder={value.length ? "" : placeholder ?? "Type and press Enter"}
        aria-label={placeholder ?? "Add item"}
        className="min-w-[120px] flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
