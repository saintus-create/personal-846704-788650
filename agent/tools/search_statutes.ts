import { defineTool } from "eve/tools";
import { z } from "zod";
import { CODE_NAMES, codesFor, loadCode } from "../lib/corpus.js";
import { scoreSections } from "../lib/search.js";

export default defineTool({
  description:
    "Search the complete California Codes (all 29 codes + the Constitution, every section with full text and legislative history). " +
    "Use this FIRST for any California law question. Returns numbered statute sources like [1], [2] to cite inline.",
  inputSchema: z.object({
    queries: z.array(z.string().min(2)).min(1).max(4).describe("Search phrases — the question's key terms"),
    codes: z.array(z.string()).optional().describe("Optional code abbreviations to prioritize, e.g. [\"CIV\", \"CCP\"]"),
    limit: z.number().int().min(4).max(24).optional(),
  }),
  async execute({ queries, codes, limit }) {
    const abbrs = codesFor(codes);
    const records: Array<{ abbr: string; r: Record<string, unknown> }> = [];
    const loaded = await Promise.all(abbrs.map((a) => loadCode(a).catch(() => [])));
    abbrs.forEach((a, i) => {
      for (const r of loaded[i]) records.push({ abbr: a, r: r as unknown as Record<string, unknown> });
    });
    const hits = scoreSections(queries, records, codes, limit ?? 16);
    if (!hits.length) return { sources: [], note: "No matching statutes found. Try different terms." };
    return {
      note: "Cite these inline with their bracketed markers, e.g. [1] or [2], right after the sentence each supports.",
      sources: hits.map((h, i) => ({
        marker: `[${i + 1}]`,
        citation: h.citation + (h.repealed ? " (REPEALED)" : ""),
        code: (CODE_NAMES[h.abbr] || h.abbr) + " (" + h.abbr + ")",
        text: h.text,
        ...(h.history ? { legislative_history: h.history } : {}),
      })),
    };
  },
});
