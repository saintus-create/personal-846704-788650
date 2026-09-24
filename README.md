# CA Leg Info

An AI legal research assistant for California law, packed with California Legislative
Information data: the complete California Codes, the full 2025-2026 session bill catalog,
the California Rules of Court, a state/local agency directory, and curated Family Code
case annotations.

**Live site:** https://saintus-create.github.io/personal-846704-788650/

## The data (public/corpus/)

| Dataset | File | Size | Contents |
|---|---|---|---|
| California Codes + Constitution | `law/*.jsonl.gz` (30 files) | 50 MB | 162,324 sections with history, browsable by division/title/chapter |
| Bills & measures, 2025-2026 session | `legislation/BILLS.jsonl.gz` | 170 KB | all 5,062 measures: subject, author, chamber, status (chaptered/active/vetoed/…), family-law flags, official leginfo links |
| California Rules of Court | `rules/ROC.jsonl.gz` | 996 KB | 1,501 rules across all 10 titles, full text + adoption history |
| Agency & public-records directory | `directory/DIRECTORY.json.gz` | 18 KB | 505 state/local agencies (POST certification, county, type), 7 policing vendors, 58 municipal surveillance contracts from city Legistar systems |
| Family Code case annotations | `cases/FAM_CASES.json.gz` | 50 KB | 152 curated appellate case summaries (DVPA/coercive-control focus) mapped to 39 Family Code sections, 4 CCP sections, and 2 section ranges |
| Index | `manifest.json` | — | per-file record counts, sha256, source dates; `extras` block describes the four datasets above |

Data provenance: codes corpus mirrored from leginfo.legislature.ca.gov; bills from the
official LegInfo bill index (retrieved 2026-08-21); rules from courts.ca.gov; directory
and case annotations compiled from public-records research. `scripts/pack_extras.py`
regenerates the four extra datasets from the sibling repos
[`family-905324`](https://github.com/saintus-create/family-905324) (bills, rules,
directory) and [`family-x1oh1xy2`](https://github.com/saintus-create/family-x1oh1xy2)
(case annotations):

```bash
python3 scripts/pack_extras.py            # downloads sources from GitHub
python3 scripts/pack_extras.py --law-repo ../family-905324 --case-repo ../family-x1oh1xy2
```

## What is deployed where

- `gh-pages` (served by GitHub Pages) = the product: a single-page app at the root.
  - `index.html` + `assets/` — the AI app: research pipeline (understand, retrieve,
    analyze, reason, answer with citations) plus Bills, Rules, and Directory browsers
  - `corpus/` — everything in the table above
- `main` (this branch) = source of record:
  - `app/` — the live app's Vite/React source; `app/dist` after `npm run build` is
    exactly the gh-pages root (vite copies `public/` into `dist/`)
  - `public/corpus/` — the datasets (source of record for gh-pages `corpus/`)
  - `src/`, `scripts/generate.py` — the earlier Starlight/Astro build (RETIRED; kept
    for reference — not what is deployed)

Deploy with one command (builds, syncs `app/dist` → `gh-pages`, pushes):

```bash
./scripts/deploy-gh-pages.sh "deploy: describe the change"
```

## The AI pipeline

Each question runs: understand/decompose (LLM) -> retrieve statutes from the in-browser
corpus + matching bills from the 2025-26 session catalog + California Rules of Court +
judicial opinions via CourtListener (California first, then nationwide persuasive
authority) -> analyze/prioritize candidates (LLM) -> reason across sources and answer
with clickable citations: `[1]` statutes (jump into the code browser), `[b1]` bills
(open the official leginfo text), `[r1]` rules (jump into the Rules browser), `[c1]`
cases (open CourtListener). Family Code answers also pull the curated case annotations.
Engine: Sarvam AI baked in (sarvam-105b-conversations); OpenRouter / Mistral / free
engine switchable in settings.

Bring your own keys: a free CourtListener token unlocks full case-law search;
OpenRouter/Mistral keys swap the engine.

## Local development

```bash
cd app && npm install && npm run dev    # serves the app + ../public corpus at :5173
```

Dated research snapshot - verify at leginfo.legislature.ca.gov. Not legal advice.
