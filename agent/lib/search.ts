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

/** count word-boundary occurrences of t in hay (capped) */
function countTerm(hay: string, t: string): number {
  let n = 0;
  let i = hay.indexOf(t);
  while (i !== -1 && n < 6) {
    const before = i > 0 ? hay[i - 1] : " ";
    const after = i + t.length < hay.length ? hay[i + t.length] : " ";
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) n++;
    i = hay.indexOf(t, i + t.length);
  }
  return n;
}

// words that only name a code (e.g. "family", "code", "penal") match cross-references
// everywhere; they are noise once the search is narrowed to that code.
const CODE_TO_ABBR: Record<string, string> = {
  family: "FAM",
  penal: "PEN",
  civil: "CCP",
  government: "GOV",
  insurance: "INS",
  education: "EDC",
  evidence: "EVI",
  welfare: "WIC",
  business: "BPC",
  professions: "BPC",
  health: "HSC",
  safety: "HSC",
  revenue: "RTC",
  taxation: "RTC",
  vehicle: "VEH",
  water: "WAT",
  labor: "LAB",
  elections: "ELC",
  probate: "PRO",
  corporations: "CORP",
  financial: "FIN",
  commercial: "COM",
  food: "FAC",
  agricultural: "FAC",
  fish: "FGC",
  game: "FGC",
  utilities: "PUC",
  resources: "PRC",
};

const CODE_NAME_WORDS = new Set(
  [
    "family code",
    "penal code",
    "civil code",
    "government code",
    "code civil procedure",
    "code civil procedure",
    "civil procedure code",
    "insurance code",
    "education code",
    "evidence code",
    "welfare institutions code",
    "business professions code",
    "health safety code",
    "revenue taxation code",
    "vehicle code",
    "water code",
    "labor code",
    "elections code",
    "probate code",
    "streets highways code",
    "public contract code",
    "harbors navigation code",
    "military veterans code",
    "food agricultural code",
    "corporations code",
    "financial code",
    "unemployment insurance code",
    "commercial code",
    "fish game code",
    "public resources code",
    "public utilities code",
  ].join(" ")
    .split(" "),
);

export function scoreSections(
  queries: string[],
  records: Array<{ abbr: string; r: Record<string, unknown> }>,
  codePriority?: string[],
  limit = 24,
): ScoredSection[] {
  const qsets = queries.map((q) => ({
    raw: q.toLowerCase(),
    terms: termsOf(q).filter((t) => !CODE_NAME_WORDS.has(t)),
  }));
  // code names in the query imply a code priority
  const implied = queries
    .join(" ")
    .toLowerCase()
    .match(
      /\b(family|penal|civil|government|insurance|education|evidence|welfare|business|professions|health|safety|revenue|taxation|vehicle|water|labor|elections|probate|streets|highways|public\s+contract|harbors|navigation|military|veterans|food|agricultural|corporations|financial|commercial|fish|game|resources|utilities)\s+code\b/g,
    );
  const impliedCodes = implied
    ? [...new Set(implied.map((m) => CODE_TO_ABBR[m.replace(/\s+code$/, "").trim()] ?? "").filter(Boolean))]
    : [];
  const effectivePriority = codePriority?.length
    ? codePriority
    : impliedCodes.length
      ? impliedCodes
      : codePriority;
  const allTerms = [...new Set(qsets.flatMap((q) => q.terms))];
  const out: Array<{ abbr: string; r: Record<string, unknown>; score: number }> = [];
  for (const { abbr, r } of records) {
    if (r.kind !== "section" || !r.text) continue;
    const structural = [r.division, r.part, r.chapter, r.article]
      .map((x) => String(x || ""))
      .filter(Boolean)
      .join(" ");
    const hay = (
      String(r.citation || "") +
      " " +
      structural +
      " " +
      String(r.text)
    ).toLowerCase();
    const textLower = String(r.text || "").toLowerCase();
    const citation = String(r.citation || "").toLowerCase();
    const isDefinition =
      textLower.includes("means any of the following") ||
      /[\u201c"][^\u201d"]{1,60}[\u201d"]\s+means\s/.test(textLower);
    let score = 0;
    for (const q of qsets) {
      // phrase bonus only for 3+ word phrases (short phrases are cross-reference noise)
      if (q.raw.length > 3 && q.raw.split(" ").length >= 3 && hay.includes(q.raw)) score += 36;
      for (const t of q.terms) {
        if (citation.includes(t)) score += 12;
        const stem = t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t;
        const n = Math.max(countTerm(hay, t), countTerm(hay, stem));
        if (n > 0) {
          score += Math.min(10, t.length + 3); // first occurrence
          score += Math.min(12, (n - 1) * 4); // repeat occurrences signal topicality
        } else if (hay.includes(t)) score += Math.min(5, t.length);
      }
    }
    // the section that DEFINES a queried term ("abuse" means ...) outranks
    // sections that merely mention the term repeatedly
    const definesQueriedTerm = allTerms.some(
      (t) =>
        textLower.includes("\u201c" + t + "\u201d means") ||
        textLower.includes('"' + t + '" means') ||
        textLower.includes(t + " means any of the following"),
    );
    if (score > 0) {
      if (
        (isDefinition || definesQueriedTerm) &&
        qsets.some((q) => /defin|what is|element|meaning|list|include/.test(q.raw))
      ) {
        score += 6;
      }
      if (definesQueriedTerm) score += 30;
      if (effectivePriority && effectivePriority.includes(abbr)) score += 25;
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
