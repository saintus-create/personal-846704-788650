import { CODE_NAMES, loadCode } from "./agent/lib/corpus";
import { scoreSections } from "./agent/lib/search";
const records: Array<{ abbr: string; r: Record<string, unknown> }> = [];
for (const a of Object.keys(CODE_NAMES)) {
  for (const r of await loadCode(a).catch(() => [])) records.push({ abbr: a, r: r as Record<string, unknown> });
}
const hits = scoreSections(["in the family code what is domestic abuse list all of them every element"], records, ["FAM"], 8);
console.log(hits.map(h => `${h.citation} (${h.score})`).join("\n"));
