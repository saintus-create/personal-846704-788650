import { CODE_NAMES, loadCode } from "./agent/lib/corpus";
import { scoreSections } from "./agent/lib/search";
const records: Array<{ abbr: string; r: Record<string, unknown> }> = [];
for (const a of Object.keys(CODE_NAMES)) {
  for (const r of await loadCode(a).catch(() => [])) records.push({ abbr: a, r: r as Record<string, unknown> });
}
const q = "In the Family Code, what is domestic abuse? List all of them, every element.";
const hits = scoreSections([q], records, undefined, 6);
console.log(hits.map(h => `   ${h.citation} (${h.score})`).join("\n"));
