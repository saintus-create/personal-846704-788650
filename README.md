# CA Leg Info

The complete California Codes (29 codes + the Constitution, 162,324 sections of full
statutory text) as a searchable docs site, built with Astro + Starlight.

Live site: https://saintus-create.github.io/personal-846704-788650/

Structure:
- main: the site source (src/content/docs, src/pages/codes, public/corpus, scripts/generate.py)
- gh-pages: the built site, served by GitHub Pages
- phase-1 ... phase-6: build intermediates (safe to delete)

Features: full statutory text of every code, site search (Pagefind), Ask AI page
(bring your own key: Sarvam AI, OpenRouter, or Mistral), corpus downloads.

Rebuilding: npm install; python3 scripts/generate.py; npm run build.
Note: the full one-shot build needs a lot of RAM; this repo was built in phases.

Dated research snapshot. Verify current text at leginfo.legislature.ca.gov. Not legal advice.
