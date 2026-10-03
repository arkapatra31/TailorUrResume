import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import type { Doc, TemplateId, TruthFlag } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Tip } from "./ui/tooltip";

interface Props {
  doc: Doc;
  template?: TemplateId;
  flags?: TruthFlag[];
  editable?: boolean;
  streaming?: boolean;
  busyKey?: string | null;
  fontSize?: number;
  tall?: boolean;
  onChange?: (d: Doc) => void;
  onRegen?: (s: number, i: number, b: number) => void;
}

function Editable({ value, onCommit, editable, className }: { value: string; onCommit: (v: string) => void; editable?: boolean; className?: string }) {
  if (!editable) return <span className={className}>{value}</span>;
  return (
    <span
      className={className}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-label="Editable text"
      onBlur={(e) => {
        const v = (e.currentTarget.textContent ?? "").trim();
        if (v !== value) onCommit(v);
      }}
    >
      {value}
    </span>
  );
}

export function PaperDoc({ doc, template = "classic", flags = [], editable, streaming, busyKey, fontSize, tall, onChange, onRegen }: Props) {
  const flagMap = useMemo(() => {
    const m = new Map<string, TruthFlag>();
    flags.forEach((f) => m.set(`${f.section}:${f.item}:${f.bullet}`, f));
    return m;
  }, [flags]);
  const edit = (fn: (d: Doc) => void) => {
    const d = structuredClone(doc);
    fn(d);
    onChange?.(d);
  };
  const letter = doc.kind === "cover_letter";

  const FlagMark = ({ f }: { f?: TruthFlag }) =>
    f ? (
      <Tip label={<span>Not found in your profile: <b>{f.unsupported.join(", ")}</b>. Edit or remove before sending.</span>}>
        <span className="mr-1 inline-flex align-middle text-amber-600" role="img" aria-label="Unverified claim"><AlertTriangle className="size-[1.1em]" /></span>
      </Tip>
    ) : null;

  return (
    <div className={cn("paper", tall && "tall")} data-template={template} style={fontSize ? { fontSize } : undefined}>
      {doc.name && <h1>{doc.name}</h1>}
      {doc.contact.length > 0 && <div className="p-contact">{doc.contact.join("  |  ")}</div>}
      {doc.sections.map((s, si) => (
        <section key={si}>
          {s.title && !letter && <h2>{s.title}</h2>}
          {s.paragraphs.map((p, pi) => {
            const f = flagMap.get(`${si}:-1:${pi}`);
            return (
              <p key={pi} className={cn(letter ? "mb-[0.9em]" : "mb-[0.3em]", f && "flagged")}>
                <FlagMark f={f} />
                <Editable value={p} editable={editable} onCommit={(v) => edit((d) => { d.sections[si].paragraphs[pi] = v; })} />
              </p>
            );
          })}
          {s.items.map((it, ii) => (
            <div key={ii} className="mb-[0.5em]">
              {(it.heading || it.dates) && (
                <div className="flex items-baseline justify-between gap-2">
                  <span>
                    <FlagMark f={flagMap.get(`${si}:${ii}:-2`)} />
                    <b><Editable value={it.heading} editable={editable} onCommit={(v) => edit((d) => { d.sections[si].items[ii].heading = v; })} /></b>
                    {it.subheading && <i> — <Editable value={it.subheading} editable={editable} onCommit={(v) => edit((d) => { d.sections[si].items[ii].subheading = v; })} /></i>}
                  </span>
                  <span className="whitespace-nowrap text-[0.92em] opacity-80">{it.dates}</span>
                </div>
              )}
              {it.note && (
                <p className={cn(flagMap.has(`${si}:${ii}:-1`) && "flagged")}>
                  <FlagMark f={flagMap.get(`${si}:${ii}:-1`)} />
                  <Editable value={it.note} editable={editable} onCommit={(v) => edit((d) => { d.sections[si].items[ii].note = v; })} />
                </p>
              )}
              {it.bullets.length > 0 && (
                <ul className="ml-[1.3em] list-disc">
                  {it.bullets.map((b, bi) => {
                    const key = `${si}:${ii}:${bi}`;
                    const f = flagMap.get(key);
                    return (
                      <li key={bi} className={cn(f && "flagged")}>
                        <FlagMark f={f} />
                        <Editable value={b} editable={editable} onCommit={(v) => edit((d) => { d.sections[si].items[ii].bullets[bi] = v; })} />
                        {editable && onRegen && (
                          <button
                            type="button"
                            aria-label="Regenerate this bullet"
                            onClick={() => onRegen(si, ii, bi)}
                            disabled={busyKey === key}
                            className="p-act ml-1.5 inline-flex align-middle text-violet-600 hover:text-violet-800"
                          >
                            {busyKey === key ? <Loader2 className="size-[1.1em] animate-spin" /> : <RefreshCw className="size-[1.1em]" />}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </section>
      ))}
      {streaming && <span className="caret" aria-hidden="true" />}
    </div>
  );
}
