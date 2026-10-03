# CLAUDE.md

TailorUrResume tailors a resume, CV or cover letter to a job description with an LLM (Anthropic or Ollama),
without fabricating anything. FastAPI backend (`backend/`) + React/Vite/TypeScript frontend (`frontend/`).

## Commands
- Backend: `cd backend && pip install -r requirements-dev.txt && uvicorn app.main:app --reload --port 8000`
- Backend tests: `cd backend && pytest` (uses `tests/fakes.py::FakeProvider`, no network or key)
- Frontend: `cd frontend && npm install && npm run dev` (http://localhost:5173, proxies `/api` to :8000)
- Type-check + build: `cd frontend && npm run build`
- E2E (API mocked in `e2e/mocks.ts`): `cd frontend && npm run test:e2e`
- Docker: `docker compose up --build` (UI :3000, API :8000)

## Hard rules
- **Stateless and private.** No DB, disk writes, server sessions or caches. Every request carries its own state.
  The frontend store (`src/store.ts`) is in memory only: no localStorage/sessionStorage/cookies/IndexedDB.
  Session export (`lib/session.ts`) never includes the API key.
- **The API key** travels only as the `X-LLM-Key` header, is never logged (`logging_utils.py` redacts it)
  and never stored.
- **Never fabricate.** Generation may use only facts from the profile. Any new feature that touches
  generation must keep `tailor/truth.py` flagging claims not traceable to the profile.

## Pipeline (6 steps: Key, Profile, Job, Match, Craft, Export)
- `profile/parse.py`: file -> text -> `Profile` via `complete_json`. Never fills `attested_skills`.
- `jd/fetchers.py` + `jd/extract.py`: job URL/text -> `JobDescription`.
- `tailor/match.py`: keyword coverage (must-have weight 3) blended 55/45 with LLM semantic fit -> `MatchResult`
  (`matched`, `missing`, `gaps`, `suggestions` = "Next steps" in the UI).
- `tailor/bridge.py` (`POST /api/bridge`): judges each missing skill `supported | partial | unsupported`
  against existing experience (e.g. Gen AI <- LangChain, Claude SDK). The LLM verdict is re-grounded:
  evidence must literally appear in the profile, and a specific technology (Java, Kubernetes...) is never
  "supported" by a different one (capped at `partial`).
- `tailor/generate.py`: streamed SSE generation (`token`, `bridge`, `warning`, `done` events).
  - `Profile.attested_skills` (user-approved on Match, or auto-added) are claimable, grounded in their evidence;
    all other missing skills go in the "do not claim" list. They are worked in by rephrasing the related
    wording their evidence points to (e.g. "LLM apps" -> "Gen AI apps"; Skills line "Gen AI (LangChain, ...)"),
    never by adding new bullets or achievements.
  - `GenerateRequest.auto_bridge` (Craft step opt-in): runs the bridge first; `supported` skills are added,
    `partial` ones are mentioned as related experience only, `unsupported` ones stay out.
  - Match gaps and next steps are always passed as guidance on emphasis/wording, never as a source of facts;
    conditional next steps ("if you used AWS...") apply only when the profile proves the condition.
- `tailor/truth.py`: flags JD terms, tech, metrics, proper nouns, "N years", headers/dates and contact lines not
  in the profile. Attested skills + evidence count as profile facts; self-attested ones also get an
  `level="info"` flag (shown separately, not counted as unverified).
- `export/`: PDF (WeasyPrint) and DOCX, templates `classic | modern | compact`.

## Conventions
- LLM-filled models subclass `schemas.Lenient` (tolerates nulls, numbers-as-strings, lone strings for lists).
- All LLM JSON goes through `LLMProvider.complete_json` (one repair retry). Errors surface as `LLMError`.
- When adding a schema field, mirror it in `frontend/src/lib/types.ts` and the zod schema in `lib/session.ts`
  (optional with a default, so older session files still load).
- New LLM schemas need a branch in `tests/fakes.py::FakeProvider.complete_json`.
- Frontend: Tailwind + small `components/ui/*` primitives, zustand store, `@/` path alias, framer-motion.
  Keep text AA-contrast on the Emerald + Slate theme (no purple).
- Keep code style terse and match surrounding density; comments explain why, not what.
