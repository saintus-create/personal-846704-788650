const STOP = new Set("what which who whom whose when where why how is are was were be been being am do does did done can could shall should would will may might must i you he she it we they me him her us them my your his its our their this that these those a an the and or but if then than so as of in to for on at by with from into about over under again further once here there all any both each few more most other some such no nor not only own same too very just dont shouldnt now".split(" "));

export function termsOf(q: string): string[] {
  return [...new Set(q.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];
}

export interface ScoredSection {
  abbr: string;
  section: string;
  citation: string;
  text: string;
  history?: string;
  repealed?: boolean;
  score: number;
}

export function scoreSections(
  queries: string[],
  records: Array<{ abbr: string; r: Record<string, unknown> }>,
  codePriority?: string[],
  limit = 24,
): ScoredSection[] {
  const qsets = queries.map((q) => ({ raw: q.toLowerCase(), terms: termsOf(q) }));
  const out: Array<{ abbr: string; r: Record<string, unknown>; score: number }> = [];
  for (const { abbr, r } of records) {
    if (r.kind !== "section" || !r.text) continue;
    const hay = (String(r.citation || "") + " " + String(r.text)).toLowerCase();
    const citation = String(r.citation || "").toLowerCase();
    let score = 0;
    for (const q of qsets) {
      if (q.raw.length > 3 && hay.includes(q.raw)) score += 36;
      for (const t of q.terms) {
        if (citation.includes(t)) score += 12;
        else if (hay.includes(" " + t + " ")) score += Math.min(10, t.length + 3);
        else if (hay.includes(t)) score += Math.min(5, t.length);
      }
    }
    if (score > 0) {
      if (codePriority && codePriority.includes(abbr)) score += 25;
      if (r.repealed) score -= 8;
      out.push({ abbr, r, score });
    }
  }
  out.sort((a, b) => b.score - a.score);
  const res: ScoredSection[] = [];
  const perCode: Record<string, number> = {};
  for (const o of out) {
    if (res.length >= limit) break;
    perCode[o.abbr] = (perCode[o.abbr] || 0) + 1;
    if (perCode[o.abbr] > 6) continue;
    res.push({
      abbr: o.abbr,
      section: String(o.r.section || ""),
      citation: String(o.r.citation || (o.abbr + " § " + o.r.section) || ""),
      text: String(o.r.text || "").slice(0, 1600),
      history: o.r.history ? String(o.r.history).slice(0, 200) : undefined,
      repealed: Boolean(o.r.repealed),
      score: o.score,
    });
  }
  return res;
}

const MEASURE_RE = /\b(?:ab|sb|aca|sca|acr|scr|ajr|sjr|ar|sr|hr|grp)\s*-?\s*\d{1,4}\b/gi;
export function measuresIn(q: string): string[] {
  const out: string[] = [];
  for (const m of String(q).match(MEASURE_RE) || []) out.push(m.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
  return out;
}

const RULE_RE = /\brules?\s*(\d+(?:\.\d+){0,2})\b/gi;
export function ruleNumsIn(q: string): string[] {
  const out: string[] = [];
  for (const m of String(q).match(RULE_RE) || []) {
    const n = m.replace(/.*?(\d)/, "$1");
    if (n) out.push(n);
  }
  return out;
}
