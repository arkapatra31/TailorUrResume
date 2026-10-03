import type { Doc, DocItem, DocKind, DocSection } from "./types";

/** Lenient client-side parser for the streamed Markdown subset (mirrors the backend parser). */
export function parseMarkdown(text: string, kind: DocKind): Doc {
  const doc: Doc = { kind, name: "", contact: [], sections: [] };
  let section: DocSection | null = null;
  let item: DocItem | null = null;
  const header: string[] = [];
  for (const raw of text.replace(/^```\w*\n?/, "").split("\n")) {
    const s = raw.trim();
    if (!s || s.startsWith("```")) continue;
    if (s.startsWith("### ")) {
      if (!section) { section = { title: "", paragraphs: [], items: [] }; doc.sections.push(section); }
      const p = s.slice(4).split(" | ").map((x) => x.trim());
      item = { heading: p[0] ?? "", subheading: p[1] ?? "", dates: p[2] ?? "", note: "", bullets: [] };
      if (p.length > 3) { item.dates = p[p.length - 1]; item.subheading = p.slice(1, -1).join(" | "); }
      section.items.push(item);
    } else if (s.startsWith("## ")) {
      section = { title: s.slice(3).trim(), paragraphs: [], items: [] };
      doc.sections.push(section); item = null;
    } else if (s.startsWith("# ")) {
      doc.name = s.slice(2).trim();
    } else if (!section) {
      header.push(s);
    } else if (/^[-*•]\s+/.test(s)) {
      if (!item) { item = { heading: "", subheading: "", dates: "", note: "", bullets: [] }; section.items.push(item); }
      item.bullets.push(s.replace(/^[-*•]\s+/, ""));
    } else if (item && item.heading && section.items[section.items.length - 1] === item) {
      item.note = `${item.note} ${s}`.trim();
    } else {
      section.paragraphs.push(s);
    }
  }
  for (const h of header) doc.contact.push(...h.split(/\s*[|·•]\s*/).map((x) => x.trim()).filter(Boolean));
  return doc;
}
