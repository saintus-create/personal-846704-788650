import { CODE_NAMES, loadCode } from "./agent/lib/corpus";
import { scoreSections } from "./agent/lib/search";
const records: Array<{ abbr: string; r: Record<string, unknown> }> = [];
for (const a of Object.keys(CODE_NAMES)) {
  for (const r of await loadCode(a).catch(() => [])) records.push({ abbr: a, r: r as Record<string, unknown> });
}
for (const q of ["statute of limitations personal injury", "what is domestic abuse family code definition"]) {
  const hits = scoreSections([q], records, ["CCP", "FAM"], 6);
  console.log("Q:", q);
  console.log(hits.map(h => `   ${h.citation} (${h.score})`).join("\n"));
}
