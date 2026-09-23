# CA Leg Info

An AI legal research assistant for California law, with the complete California Codes as its corpus.

**Live site:** https://saintus-create.github.io/personal-846704-788650/

## What is deployed where

- `gh-pages` (served by GitHub Pages) = the product: a single-page app at the root.
  - `index.html` — the AI app: research pipeline (understand, retrieve, analyze, reason, answer with citations)
  - `corpus/` — all 29 codes + the Constitution as `law/*.jsonl.gz` with `manifest.json`
- `main` (this branch) = source of record:
  - `app/index.html` — the live app's source (mirrors gh-pages root)
  - `src/`, `scripts/`, `public/` — the earlier Starlight/Astro build (RETIRED; kept for reference — not what is deployed)
  - `phase-1`..`phase-6` — build intermediates from the Starlight build (safe to delete)

## The AI pipeline

Each question runs: understand/decompose (LLM) -> retrieve statutes from the in-browser corpus
+ judicial opinions via CourtListener (California first, then nationwide persuasive authority) ->
analyze/prioritize candidates (LLM) -> reason across sources and answer with clickable citations.
Engine: Sarvam AI baked in (sarvam-105b-conversations); OpenRouter / Mistral / free engine switchable in settings.

Bring your own keys: a free CourtListener token unlocks full case-law search; OpenRouter/Mistral keys swap the engine.

Dated research snapshot - verify at leginfo.legislature.ca.gov. Not legal advice.
