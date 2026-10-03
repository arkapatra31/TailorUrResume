import type { Doc, Profile } from "./types";

/** Render the original profile as a Document, used as the left side of the diff view. */
export function profileToDoc(p: Profile): Doc {
  const range = (a: string, b: string) => [a, b].filter(Boolean).join(" – ");
  const sections: Doc["sections"] = [];
  if (p.summary) sections.push({ title: "Summary", paragraphs: [p.summary], items: [] });
  if (p.skills.length) sections.push({ title: "Skills", paragraphs: [p.skills.join(", ")], items: [] });
  if (p.experience.length)
    sections.push({
      title: "Experience", paragraphs: [],
      items: p.experience.map((e) => ({ heading: e.title, subheading: e.company, dates: range(e.start, e.end), note: "", bullets: e.bullets })),
    });
  if (p.projects.length)
    sections.push({
      title: "Projects", paragraphs: [],
      items: p.projects.map((e) => ({ heading: e.name, subheading: e.tech.join(", "), dates: "", note: e.description, bullets: e.bullets })),
    });
  if (p.education.length)
    sections.push({
      title: "Education", paragraphs: [],
      items: p.education.map((e) => ({ heading: [e.degree, e.field].filter(Boolean).join(", "), subheading: e.school, dates: range(e.start, e.end), note: "", bullets: e.details })),
    });
  if (p.certifications.length) sections.push({ title: "Certifications", paragraphs: p.certifications, items: [] });
  if (p.publications.length) sections.push({ title: "Publications", paragraphs: p.publications, items: [] });
  const c = p.contact;
  return { kind: "cv", name: c.name, contact: [c.email, c.phone, c.location, ...c.links].filter(Boolean), sections };
}
