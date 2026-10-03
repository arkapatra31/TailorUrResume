# TailorUrResume landing page

The project website, deployed to GitHub Pages by `.github/workflows/pages.yml`. It is a separate Vite + React +
TypeScript + Tailwind app (same stack and Emerald + Slate theme as `frontend/`), with no backend and no browser storage.

```bash
cd web
npm install
npm run dev      # http://localhost:5174
npm run build    # type-checks, then builds to web/dist
```

- `vite.config.ts` uses a relative `base`, so the build works under `https://<user>.github.io/TailorUrResume/`.
- The interactive demos share one fictional candidate and job (`src/lib/demo.ts`).
- The truth-guard playground runs `src/lib/truth.ts`, a simplified browser port of the free-text checks in
  `backend/app/tailor/truth.py`. Keep its word lists in sync when those change.

## Product screenshots

`public/shots/*.webp` are real screens of the app, captured by driving the UI against a mocked API with the same demo
data. Regenerate them after UI changes:

```bash
cd frontend
SHOTS_DIR=../web/public/shots npx playwright test screenshots
```

`public/og.png` (the 1200x630 social preview) is a capture of the hero section with its demo in the final state.
