import type { AttestedSkill, JobDescription, MatchResult, Profile } from "./types";

/** Same weighting as the backend (tailor/match.py). */
const KEYWORD_WEIGHT = 0.55;

export const sameSkill = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const attestedOf = (p: Profile | null): AttestedSkill[] => p?.attested_skills ?? [];

export function upsertAttested(p: Profile, a: AttestedSkill): Profile {
  const rest = attestedOf(p).filter((x) => !sameSkill(x.skill, a.skill));
  return { ...p, attested_skills: [...rest, a] };
}

export function removeAttested(p: Profile, skill: string): Profile {
  return { ...p, attested_skills: attestedOf(p).filter((x) => !sameSkill(x.skill, skill)) };
}

/** Estimated score if the added skills counted as matched keywords (semantic fit unchanged). */
export function previewScore(m: MatchResult, jd: JobDescription | null, added: string[]): { score: number; keyword: number } {
  if (!jd || !added.length) return { score: m.score, keyword: m.keyword_score };
  const weights = new Map<string, number>();
  for (const t of jd.keywords) if (t.trim() && !weights.has(t.trim().toLowerCase())) weights.set(t.trim().toLowerCase(), 1);
  for (const t of jd.nice_to_have) if (t.trim()) weights.set(t.trim().toLowerCase(), 1);
  for (const t of jd.must_have) if (t.trim()) weights.set(t.trim().toLowerCase(), 3);
  if (!weights.size) return { score: m.score, keyword: m.keyword_score };
  const hit = new Set([...m.matched, ...added].map((t) => t.trim().toLowerCase()));
  let got = 0, total = 0;
  for (const [t, w] of weights) { total += w; if (hit.has(t)) got += w; }
  const keyword = Math.round((100 * got) / total);
  const score = Math.max(0, Math.min(100, Math.round(KEYWORD_WEIGHT * keyword + (1 - KEYWORD_WEIGHT) * m.semantic_score)));
  return { score, keyword };
}
