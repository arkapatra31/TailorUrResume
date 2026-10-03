import { useMemo } from "react";
import { similarity, wordDiff, type Seg } from "@/lib/diff";
import { profileToDoc } from "@/lib/profileDoc";
import type { Doc, Profile } from "@/lib/types";

const Segs = ({ segs }: { segs: Seg[] }) => (
  <>
    {segs.map((s, i) => (
      <span key={i} className={s.type === "add" ? "diff-add" : s.type === "del" ? "diff-del" : undefined}>{s.text}</span>
    ))}
  </>
);

interface Row { section: string; left: Seg[] | null; right: Seg[] | null; kind: "same" | "changed" | "new" | "dropped" }

function buildRows(original: Doc, tailored: Doc): Row[] {
  const pool: { text: string; used: boolean }[] = [];
  original.sections.forEach((s) => {
    s.paragraphs.forEach((p) => pool.push({ text: p, used: false }));
    s.items.forEach((it) => { if (it.note) pool.push({ text: it.note, used: false }); it.bullets.forEach((b) => pool.push({ text: b, used: false })); });
  });
  const rows: Row[] = [];
  const handle = (section: string, text: string) => {
    let best = -1, bestSim = 0.28;
    pool.forEach((p, i) => { if (p.used) return; const sim = similarity(p.text, text); if (sim > bestSim) { bestSim = sim; best = i; } });
    if (best < 0) { rows.push({ section, left: null, right: [{ text, type: "add" }], kind: "new" }); return; }
    pool[best].used = true;
    const d = wordDiff(pool[best].text, text);
    rows.push({ section, left: d.left, right: d.right, kind: d.left.every((x) => x.type === "same") && d.right.every((x) => x.type === "same") ? "same" : "changed" });
  };
  tailored.sections.forEach((s) => {
    const t = s.title || "Details";
    s.paragraphs.forEach((p) => handle(t, p));
    s.items.forEach((it) => { if (it.note) handle(t, it.note); it.bullets.forEach((b) => handle(t, b)); });
  });
  pool.filter((p) => !p.used).forEach((p) => rows.push({ section: "Left out", left: [{ text: p.text, type: "del" }], right: null, kind: "dropped" }));
  return rows;
}

export function DiffView({ profile, tailored }: { profile: Profile; tailored: Doc }) {
  const rows = useMemo(() => buildRows(profileToDoc(profile), tailored), [profile, tailored]);
  const stats = useMemo(() => ({
    changed: rows.filter((r) => r.kind === "changed").length,
    added: rows.filter((r) => r.kind === "new").length,
    dropped: rows.filter((r) => r.kind === "dropped").length,
  }), [rows]);
  let last = "";
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex flex-wrap gap-4 border-b px-4 py-3 text-xs text-muted-foreground">
        <span><span className="diff-add">Added</span> / reworded words</span>
        <span><span className="diff-del">Removed</span> words</span>
        <span className="ml-auto">{stats.changed} reworded · {stats.added} new · {stats.dropped} left out</span>
      </div>
      <div className="grid grid-cols-2 border-b text-xs font-semibold uppercase tracking-wide">
        <div className="px-4 py-2">Original profile</div>
        <div className="border-l px-4 py-2">Tailored</div>
      </div>
      <div className="scroll-thin max-h-[70vh] overflow-auto">
        {rows.map((r, i) => {
          const head = r.section !== last ? ((last = r.section), <div key={`h${i}`} className="bg-muted/50 px-4 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{r.section}</div>) : null;
          return (
            <div key={i}>
              {head}
              <div className="grid grid-cols-2 text-sm leading-relaxed">
                <div className="px-4 py-2 text-foreground/90">{r.left ? <Segs segs={r.left} /> : <span className="text-muted-foreground">—</span>}</div>
                <div className="border-l px-4 py-2">{r.right ? <Segs segs={r.right} /> : <span className="text-muted-foreground">Not used</span>}</div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="p-6 text-sm text-muted-foreground">Nothing to compare yet.</p>}
      </div>
    </div>
  );
}
