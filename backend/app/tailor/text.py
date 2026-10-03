"""Text helpers shared by matching and the truthfulness guard."""
from __future__ import annotations

import re

from ..schemas import Document, Profile

ALIASES = {
    "js": "javascript", "ts": "typescript", "k8s": "kubernetes", "golang": "go",
    "postgres": "postgresql", "nodejs": "node.js", "node": "node.js", "reactjs": "react",
    "react.js": "react", "vuejs": "vue", "ml": "machine learning", "ai": "artificial intelligence",
    "gcp": "google cloud", "tf": "terraform", "ci/cd": "cicd", "ci-cd": "cicd",
}
STOP = set(
    "a an the and or of to in on for with at by from as is are be been this that these those "
    "you your we our their it its will can must should may have has had using use used "
    "experience years year strong knowledge ability skills skill working work etc plus "
    "including include such than more least well good great excellent proven related".split()
)
TOKEN_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9\+\#\.]*(?:[\-/][A-Za-z0-9\+\#\.]+)*")


def norm(word: str) -> str:
    w = word.lower().strip(".,;:()[]{}\"'")
    w = ALIASES.get(w, w)
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        w = w[:-1]
    return w


def tokens(text: str) -> list[str]:
    return [t.rstrip(".") for t in TOKEN_RE.findall(text)]


def vocab(text: str) -> set[str]:
    out: set[str] = set()
    for t in tokens(text):
        out.add(norm(t))
        for part in re.split(r"[\-/]", t):
            if part:
                out.add(norm(part))
    return out


def profile_text(p: Profile) -> str:
    parts: list[str] = [p.summary, p.contact.name, p.contact.location]
    for e in p.experience:
        parts += [e.company, e.title, e.location, e.start, e.end, *e.bullets]
    for pr in p.projects:
        parts += [pr.name, pr.description, *pr.tech, *pr.bullets]
    for ed in p.education:
        parts += [ed.school, ed.degree, ed.field, ed.start, ed.end, *ed.details]
    parts += p.skills + p.certifications + p.publications
    return "\n".join(x for x in parts if x)


def term_in(term: str, corpus_vocab: set[str], corpus_lower: str) -> bool:
    """Does a (possibly multi-word) JD term appear in the corpus?"""
    t = term.lower().strip()
    if not t:
        return False
    if re.search(r"(?<![a-z0-9])" + re.escape(t) + r"(?![a-z0-9])", corpus_lower):
        return True
    words = [norm(w) for w in tokens(t) if norm(w) not in STOP]
    if not words:
        return False
    hit = sum(1 for w in words if w in corpus_vocab)
    return hit / len(words) >= (1.0 if len(words) == 1 else 0.7)


def doc_text(doc: Document) -> str:
    parts = [doc.name, *doc.contact]
    for s in doc.sections:
        parts += [s.title, *s.paragraphs]
        for it in s.items:
            parts += [it.heading, it.subheading, it.dates, it.note, *it.bullets]
    return "\n".join(p for p in parts if p)
