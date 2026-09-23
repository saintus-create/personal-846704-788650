# CA Leg Info - the app (React + Vite + Tailwind + shadcn/ui)

This is the source of the live site (deployed from `dist/` to the `gh-pages` branch root).

- `src/lib/engine.js` - the research pipeline: providers, corpus loading, retrieval, planning, analysis, CourtListener case law
- `src/components/` - Chat, Browser, and the shadcn/ui component set (Radix primitives)
- localStorage keys (`ai2.*`) are shared with the previous single-file app - user settings carry over

Build: `npm install && npm run build` -> deploy `dist/` contents to `gh-pages` root (keep `corpus/`, `.nojekyll`, `favicon.svg`).
