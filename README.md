# California Legislative Information

An AI legal research assistant for California law, built on the
[vercel/eve chat template](https://github.com/vercel/eve/tree/main/apps/templates/eve-chat-template)
(Next.js 16 + the eve agent framework), deployed on Vercel.

## What it is

- **Ask the agent** — it searches the complete California Codes (162,324 sections), the
  2025-26 legislative session catalog (5,062 bills), the California Rules of Court
  (1,501 rules), and CourtListener case law, then answers with inline citations
  ([1] statutes, [b1] bills, [r1] rules, [c1] cases).
- **Browse the library** — `/codes`, `/bills`, `/rules`, `/directory`.
- Chats persist in the browser (starter mode; no database needed).

## Agent

- `agent/instructions.md` — the system prompt (direct answers, no hedging, never fabricate).
- `agent/agent.ts` — model wiring (Sarvam 105B via OpenAI-compatible provider; set
  `SARVAM_API_KEY` in Vercel to override the built-in key).
- `agent/tools/` — `search_statutes`, `lookup_section`, `search_bills`, `search_rules`,
  `search_cases`. Server-side; corpus is read from `public/corpus/` (fs first, then
  self-origin fetch).
- `agent/channels/eve.ts` — open public access (no password).

## Data

`public/corpus/` — codes from leginfo.legislature.ca.gov, bills from the official
LegInfo index (retrieved 2026-08-21), Rules of Court from courts.ca.gov, and a
curated Family Code case-annotation set (64 cases / 103 annotations).
`scripts/pack_extras.py` regenerates the extras.

## Development

```bash
npm install
npm run dev          # Next.js app (the eve runtime auto-starts; Node >= 24 required for it)
npm run build         # production build
npm run build:eve     # build the agent runtime separately (.output/)
```

Dated research snapshot — verify at leginfo.legislature.ca.gov. Not legal advice.
