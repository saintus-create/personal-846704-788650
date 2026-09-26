import { loadCode } from "./agent/lib/corpus";
import { scoreSections } from "./agent/lib/search";
const fam = await loadCode("FAM");
console.log("6203 record has division:", fam.find(r => r.section === "6203" && !r.repealed)?.division);
const hits = scoreSections(["domestic abuse definition family code"], [{ abbr: "FAM", r: fam.find(r => r.section === "6203") as any }].filter(x => x.r), ["FAM"], 8);
console.log("6203 solo score:", JSON.stringify(hits));
