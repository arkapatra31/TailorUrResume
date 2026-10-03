export interface Contact { name: string; email: string; phone: string; location: string; links: string[] }
export interface Experience { company: string; title: string; location: string; start: string; end: string; bullets: string[] }
export interface Project { name: string; description: string; tech: string[]; bullets: string[] }
export interface Education { school: string; degree: string; field: string; start: string; end: string; details: string[] }
/** A missing job skill the user approved on the Match step. */
export interface AttestedSkill { skill: string; evidence: string; self_attested: boolean }
export interface Profile {
  contact: Contact; summary: string; experience: Experience[]; projects: Project[];
  education: Education[]; skills: string[]; certifications: string[]; publications: string[];
  attested_skills?: AttestedSkill[];
}
export type BridgeVerdict = "supported" | "partial" | "unsupported";
export interface BridgeItem { skill: string; verdict: BridgeVerdict; evidence: string[]; rationale: string }
export interface JobDescription {
  title: string; company: string; location: string; seniority: string; summary: string;
  must_have: string[]; nice_to_have: string[]; responsibilities: string[]; keywords: string[]; source_url: string;
}
export interface MatchResult {
  score: number; keyword_score: number; semantic_score: number; matched: string[]; missing: string[];
  strengths: string[]; gaps: string[]; suggestions: string[];
}
export interface DocItem { heading: string; subheading: string; dates: string; note: string; bullets: string[] }
export interface DocSection { title: string; paragraphs: string[]; items: DocItem[] }
export type DocKind = "resume" | "cv" | "cover_letter";
export interface Doc { kind: DocKind; name: string; contact: string[]; sections: DocSection[] }
export interface TruthFlag { text: string; section: number; item: number; bullet: number; unsupported: string[]; reason: string; level?: "warn" | "info" }
export type TemplateId = "classic" | "modern" | "compact";
export type Provider = "anthropic" | "ollama";

export interface GeneratedDoc { doc: Doc; flags: TruthFlag[]; generatedAt: number }
export interface FetchedJob { source: string; url: string; text: string; title: string; company: string; location: string }

export interface Job {
  id: string;
  url: string;
  rawText: string;
  fetched?: FetchedJob;
  jd: JobDescription | null;
  match: MatchResult | null;
  bridge?: BridgeItem[] | null;
  docs: Partial<Record<DocKind, GeneratedDoc>>;
}

export const emptyProfile = (): Profile => ({
  contact: { name: "", email: "", phone: "", location: "", links: [] },
  summary: "", experience: [], projects: [], education: [], skills: [], certifications: [], publications: [], attested_skills: [],
});
