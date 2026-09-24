import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadJsonl } from "../lib/corpus.js";
import { ruleNumsIn, termsOf } from "../lib/search.js";

export default defineTool({
  description:
    "Search the California Rules of Court (all 1,501 rules, full text) — procedural rules for trial and appellate courts. " +
    "Use for questions about procedure, deadlines, filings, continuances, service. Returns rule sources like [r1], [r2] to cite inline.",
  inputSchema: z.object({
    queries: z.array(z.string().min(2)).min(1).max(4),
    limit: z.number().int().min(3).max(10).optional(),
  }),
  async execute({ queries, limit }) {
    const rules = await loadJsonl("corpus/rules/ROC.jsonl.gz").catch(() => []);
    if (!rules.length) return { sources: [], note: "Rules corpus unavailable." };
    const qsets = queries.map((q) => ({ terms: termsOf(q), nums: ruleNumsIn(q) }));
    const out: Array<{ r: Record<string, unknown>; score: number }> = [];
    for (const r of rules) {
      const num = String(r.rule || "").toLowerCase();
      const title = String(r.rule_title || "").toLowerCase();
      const text = String(r.text || "").toLowerCase();
      let score = 0;
      for (const q of qsets) {
        for (const n of q.nums) if (n === num) score += 100;
        for (const t of q.terms) {
          if (title.includes(t)) score += 8;
          if (text.includes(" " + t + " ") || text.startsWith(t + " ") || text.endsWith(" " + t)) score += 3;
          else if (text.includes(t)) score += 1;
        }
      }
      if (score > 0) out.push({ r, score });
    }
    out.sort((a, b) => b.score - a.score);
    const top = out.slice(0, limit ?? 5).map((x) => x.r);
    if (!top.length) return { sources: [], note: "No matching rules." };
    return {
      sources: top.map((r, i) => ({
        marker: `[r${i + 1}]`,
        rule: "Cal. Rules of Court, rule " + String(r.rule || "") + (r.rule_title ? " — " + String(r.rule_title) : ""),
        text: String(r.text || "").slice(0, 1200),
        ...(r.history ? { history: String(r.history).slice(0, 160) } : {}),
      })),
    };
  },
});
