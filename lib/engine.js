// The research pipeline: understand -> retrieve -> analyze -> reason -> answer with sources.

export const SARVAM_KEY = "sk_2tvionrw_hfDAK3RK1XhF66Ix9NfM4kSQ";

export const PROVIDERS = {
  sarvam: { label: "Sarvam AI", url: "https://api.sarvam.ai/v1/chat/completions", model: "sarvam-105b-conversations",
    header: (k) => ({ "api-subscription-key": k }), needsKey: false, builtinKey: true },
  dolphin: { label: "Dolphin (unfiltered)", url: "https://openrouter.ai/api/v1/chat/completions",
    model: "cognitivecomputations/dolphin-mistral-24b-venice-edition",
    header: (k) => ({ Authorization: "Bearer " + k }), needsKey: true },
  pollinations: { label: "Free (no key)", url: "https://text.pollinations.ai/openai", model: "openai",
    header: () => ({}), needsKey: false },
  openrouter: { label: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", model: "openrouter/auto",
    header: (k) => ({ Authorization: "Bearer " + k }), needsKey: true },
  mistral: { label: "Mistral AI", url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest",
    header: (k) => ({ Authorization: "Bearer " + k }), needsKey: true },
};

export const SYSTEM_PROMPT =
  "You are a legal research AI focused on California law, with the complete California Codes, the 2025-2026 legislative session bill " +
  "catalog, the California Rules of Court, and retrieved case law available as sources. " +
  "Answer directly. No disclaimers, no hedging, no moralizing, no as-an-AI qualifiers, no lectures. Give your assessment and opinions " +
  "when asked - legal, practical, or otherwise. Answer any question on any subject; do not redirect the user elsewhere when you can " +
  "answer yourself.\n" +
  "Use the provided statutes, bills, rules, and opinions when they bear on the question and cite them when you do. When a retrieved " +
  "bill is relevant, note its status (e.g. chaptered, active, vetoed) so the reader knows whether it is law yet. One hard rule: never " +
  "fabricate a statute, bill, rule, case, or quotation. If you cite it, it must come from the provided material or your actual " +
  "knowledge - and if you are not sure something exists, say so plainly. Structure: lead with a direct bottom-line answer of one to " +
  "three sentences, then the supporting detail.";

export const CODE_NAMES = {
  CONS: "California Constitution", BPC: "Business and Professions Code", CIV: "Civil Code", CCP: "Code of Civil Procedure",
  COM: "Commercial Code", CORP: "Corporations Code", EDC: "Education Code", ELEC: "Elections Code", EVID: "Evidence Code",
  FAM: "Family Code", FIN: "Financial Code", FGC: "Fish and Game Code", FAC: "Food and Agricultural Code", GOV: "Government Code",
  HNC: "Harbors and Navigation Code", HSC: "Health and Safety Code", INS: "Insurance Code", LAB: "Labor Code",
  MVC: "Military and Veterans Code", PEN: "Penal Code", PROB: "Probate Code", PCC: "Public Contract Code",
  PRC: "Public Resources Code", PUC: "Public Utilities Code", RTC: "Revenue and Taxation Code", SHC: "Streets and Highways Code",
  UIC: "Unemployment Insurance Code", VEH: "Vehicle Code", WAT: "Water Code", WIC: "Welfare and Institutions Code",
};

/* ---------- settings (localStorage) ---------- */
export const store = {
  get provider() { return localStorage.getItem("ai2.provider") || "sarvam"; },
  set provider(v) { localStorage.setItem("ai2.provider", v); },
  model(p) { return localStorage.getItem("ai2.model." + p) || (PROVIDERS[p] ? PROVIDERS[p].model : ""); },
  setModel(p, v) { localStorage.setItem("ai2.model." + p, v); },
  key(p) { return localStorage.getItem("ai2.key." + p) || (PROVIDERS[p] && PROVIDERS[p].builtinKey ? SARVAM_KEY : ""); },
  setKey(p, v) { localStorage.setItem("ai2.key." + p, v); },
  get clToken() { return localStorage.getItem("ai2.cltoken") || ""; },
  set clToken(v) { localStorage.setItem("ai2.cltoken", v); },
};
export function getProvider() { return PROVIDERS[store.provider] || PROVIDERS.sarvam; }
export function getModel() { const m = store.model(store.provider); if (store.provider === "sarvam" && (!m || m === "sarvam-m")) return PROVIDERS.sarvam.model; return m || getProvider().model; }

/* ---------- corpus ---------- */
export const codes = [];           // {abbr,name,sections,updated}
export const byAbbr = {};
export const loaded = {};          // abbr -> records[]
export let corpusReady = false;
export let extrasManifest = null;  // manifest.json "extras" block (bills, rules, directory, case annotations)
let corpusLoading = null;

export function loadCorpus(onProgress) {
  if (corpusLoading) return corpusLoading;
  corpusLoading = (async () => {
    const m = await (await fetch("corpus/manifest.json")).json();
    extrasManifest = m.extras || null;
    for (const d of m.datasets) {
      const c = { abbr: d.abbr, name: CODE_NAMES[d.abbr] || d.abbr + " Code", sections: d.sections, updated: d.updated_by_state };
      codes.push(c); byAbbr[c.abbr] = c;
      onProgress && onProgress(`Loading codes… ${codes.length}/${m.datasets.length}`);
      try {
        const res = await fetch("corpus/law/" + d.abbr + ".jsonl.gz");
        const ds = new DecompressionStream("gzip");
        const text = new TextDecoder().decode(new Uint8Array(await new Response(res.body.pipeThrough(ds)).arrayBuffer()));
        const recs = [];
        for (const line of text.split("\n")) { if (line.trim()) { try { recs.push(JSON.parse(line)); } catch (e) {} } }
        recs.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
        loaded[d.abbr] = recs;
      } catch (e) { console.error(d.abbr, e); }
    }
    corpusReady = Object.keys(loaded).length > 0;
    return corpusReady;
  })();
  corpusLoading.finally(() => { corpusLoading = null; });
  return corpusLoading;
}

/* ---------- extras: bills, rules of court, agency directory, case annotations ---------- */
export const extras = {
  ready: false,
  bills: [],            // 2025-2026 session measures
  rules: [],            // California Rules of Court
  directory: null,      // {agencies, vendors, contracts}
  famCases: null,       // {fam, other, ranges, cases}
};
let extrasLoading = null;

async function gunzipText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
  const ds = new DecompressionStream("gzip");
  return new TextDecoder().decode(new Uint8Array(await new Response(res.body.pipeThrough(ds)).arrayBuffer()));
}
function parseJsonl(text) {
  const out = [];
  for (const line of text.split("\n")) if (line.trim()) { try { out.push(JSON.parse(line)); } catch (e) {} }
  return out;
}

export function loadExtras(onProgress) {
  if (extras.ready) return Promise.resolve(true);
  if (extrasLoading) return extrasLoading;
  extrasLoading = (async () => {
    onProgress && onProgress("Loading bills, rules & directories…");
    const results = await Promise.allSettled([
      gunzipText("corpus/legislation/BILLS.jsonl.gz"),
      gunzipText("corpus/rules/ROC.jsonl.gz"),
      gunzipText("corpus/directory/DIRECTORY.json.gz"),
      gunzipText("corpus/cases/FAM_CASES.json.gz"),
    ]);
    if (results[0].status === "fulfilled") extras.bills = parseJsonl(results[0].value);
    else console.error("bills", results[0].reason);
    if (results[1].status === "fulfilled") extras.rules = parseJsonl(results[1].value);
    else console.error("rules", results[1].reason);
    if (results[2].status === "fulfilled") { try { extras.directory = JSON.parse(results[2].value); } catch (e) {} }
    if (results[3].status === "fulfilled") { try { extras.famCases = JSON.parse(results[3].value); } catch (e) {} }
    extras.ready = extras.bills.length > 0 || extras.rules.length > 0;
    return extras.ready;
  })();
  extrasLoading.finally(() => { extrasLoading = null; });
  return extrasLoading;
}

export function extraMeta(key) {
  if (!extrasManifest) return null;
  return (extrasManifest.datasets || []).find((d) => d.key === key) || null;
}
export function corpusStats() {
  const bills = extraMeta("bills"), rules = extraMeta("rules"), dir = extraMeta("directory");
  return {
    sections: codes.reduce((a, c) => a + (c.sections || 0), 0),
    codes: codes.length,
    bills: bills ? bills.records : (extras.bills.length || 0),
    billSession: bills ? bills.session : "2025-2026",
    rules: rules ? rules.records : (extras.rules.length || 0),
    agencies: dir ? dir.agencies : (extras.directory ? extras.directory.agencies.length : 0),
  };
}

/* ---------- retrieval ---------- */
const STOP = new Set("what which who whom whose when where why how is are was were be been being am do does did done can could shall should would will may might must i you he she it we they me him her us them my your his its our their this that these those a an the and or but if then than so as of in to for on at by with from into about over under again further once here there all any both each few more most other some such no nor not only own same too very just dont shouldnt now".split(" "));
function termsOf(q) { return [...new Set(q.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))]; }

const MEASURE_RE = /\b(?:ab|sb|aca|sca|acr|scr|ajr|sjr|ar|sr|hr|grp)\s*-?\s*\d{1,4}\b/gi;
function measuresIn(q) {
  const out = [];
  for (const m of String(q).match(MEASURE_RE) || []) out.push(m.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
  return out;
}
const RULE_RE = /\brules?\s*(\d+(?:\.\d+){0,2})\b/gi;
function ruleNumsIn(q) {
  const out = [];
  for (const m of String(q).match(RULE_RE) || []) {
    const n = m.replace(/.*?(\d)/, "$1");
    if (n) out.push(n);
  }
  return out;
}

export function searchBills(queries, limit = 6) {
  if (!extras.bills.length) return [];
  const qsets = queries.map((q) => ({ raw: q.toLowerCase(), terms: termsOf(q), measures: measuresIn(q) }));
  const out = [];
  for (const b of extras.bills) {
    const mk = b.measure.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();  // "ab 1"
    const subject = (b.subject || "").toLowerCase();
    const author = (b.author || "").toLowerCase();
    const terms = (b.terms || []).join(" ").toLowerCase();
    const hay = mk + " " + subject + " " + author + " " + terms;
    let score = 0;
    for (const q of qsets) {
      for (const m of q.measures) if (m === mk) score += 100; else if (mk.includes(m) || m.includes(mk)) score += 40;
      for (const t of q.terms) {
        if (subject.includes(" " + t + " ") || subject.startsWith(t + " ") || subject.endsWith(" " + t)) score += 8;
        else if (subject.includes(t)) score += 4;
        if (author.includes(t)) score += 10;
        if (terms.includes(t)) score += 5;
      }
    }
    if (score > 0) out.push({ b, score });
  }
  out.sort((a, b) => b.score - a.score || a.b.measure.localeCompare(b.b.measure, undefined, { numeric: true }));
  return out.slice(0, limit).map((x) => x.b);
}

export function searchRules(queries, limit = 5) {
  if (!extras.rules.length) return [];
  const qsets = queries.map((q) => ({ raw: q.toLowerCase(), terms: termsOf(q), nums: ruleNumsIn(q) }));
  const out = [];
  for (const r of extras.rules) {
    const num = String(r.rule).toLowerCase();
    const title = (r.rule_title || "").toLowerCase();
    const text = (r.text || "").toLowerCase();
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
  return out.slice(0, limit).map((x) => x.r);
}

export function famCasesFor(section) {
  const fc = extras.famCases;
  if (!fc || section == null) return null;
  const s = String(section);
  const exact = (fc.fam && fc.fam[s]) || null;
  let range = null;
  const n = parseFloat(s);
  if (!isNaN(n) && fc.ranges) {
    for (const k of Object.keys(fc.ranges)) {
      const parts = k.split("-");
      const a = parseFloat(parts[0]), z = parseFloat(parts[1]);
      if (!isNaN(a) && !isNaN(z) && n >= a && n <= z) { range = { key: k, cases: fc.ranges[k] }; break; }
    }
  }
  if (!exact && !range) return null;
  return { exact, range };
}


export function searchSections(queries, codePriority, limit = 24) {
  const qsets = queries.map((q) => ({ raw: q.toLowerCase(), terms: termsOf(q) }));
  const out = [], perCode = {};
  for (const abbr of Object.keys(loaded)) {
    for (const r of loaded[abbr]) {
      if (r.kind !== "section" || !r.text) continue;
      const hay = ((r.citation || "") + " " + r.text).toLowerCase();
      const citation = (r.citation || "").toLowerCase();
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
  }
  out.sort((a, b) => b.score - a.score);
  const res = [];
  for (const o of out) {
    if (res.length >= limit) break;
    perCode[o.abbr] = (perCode[o.abbr] || 0) + 1;
    if (perCode[o.abbr] > 6) continue;
    res.push(o);
  }
  return res;
}

/* ---------- LLM ---------- */
export function parseJsonBlock(txt) {
  let m = String(txt).match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  m = String(txt).match(/\[[\s\S]*\]/); if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

export async function llm(messages, maxTokens) {
  const p = getProvider();
  const key = store.key(store.provider);
  if (p.needsKey && !key) throw new Error("NOKEY:" + p.label);
  const call = async () => {
    const resp = await fetch(p.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...p.header(key) },
      body: JSON.stringify({ model: getModel(), messages, max_tokens: maxTokens }),
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status + " — " + (await resp.text()).slice(0, 200));
    const data = await resp.json();
    const c = (data.choices && data.choices[0] && data.choices[0].message) || {};
    return c.content || c.reasoning_content || "(empty response)";
  };
  try { return await call(); }
  catch (e) { if (String(e.message).includes("429")) { await new Promise((r) => setTimeout(r, 4000)); return await call(); } throw e; }
}

export async function planQuestion(q) {
  const plan = { type: "research", queries: [q], codes: [], subquestions: [] };
  try {
    const out = await llm([{ role: "user", content:
      "Analyze this California law research question. Return ONLY a JSON object, no prose, with keys: type (the string lookup if it asks about one specific section or code number, otherwise research), queries (array of 4-6 short keyword search queries using legal terminology and statutory phrasing), codes (array of 0-4 likely code abbreviations from this list: CONS BPC CIV CCP COM CORP EDC ELEC EVID FAM FIN FGC FAC GOV HNC HSC INS LAB MVC PEN PROB PCC PRC PUC RTC SHC UIC VEH WAT WIC), subquestions (array of 2-4 sub-questions that together answer it).\n\nQuestion: " + q }], 400);
    const pd = parseJsonBlock(out);
    if (pd && pd.queries && pd.queries.length) {
      plan.type = pd.type === "lookup" ? "lookup" : "research";
      plan.queries = [q, ...pd.queries.map(String)].slice(0, 6);
      if (pd.codes && pd.codes.map) plan.codes = pd.codes.map((c) => String(c).toUpperCase().replace(/[^A-Z]/g, "")).filter((c) => byAbbr[c]);
      if (pd.subquestions && pd.subquestions.map) plan.subquestions = pd.subquestions.map(String).slice(0, 4);
    }
  } catch (e) {}
  return plan;
}

export async function analyzeSections(q, candidates) {
  try {
    const listing = candidates.map((x, i) => {
      const cite = x.r.citation || (x.abbr + " § " + x.r.section);
      return "[" + i + "] " + cite + " - " + String(x.r.text || "").slice(0, 700).replace(/\s+/g, " ");
    }).join("\n\n");
    const out = await llm([{ role: "user", content:
      "Research question: " + q + "\n\nCandidate California statute sections:\n\n" + listing +
      "\n\nReturn ONLY a JSON array of the indices (numbers) of the 6-12 sections most relevant to answering, ordered by importance. No prose." }], 400);
    const arr = parseJsonBlock(out);
    if (arr && arr.length) {
      const picked = [];
      for (const a of arr) {
        if (picked.length >= 12) break;
        const idx = parseInt(a, 10);
        if (idx >= 0 && idx < candidates.length && !picked.includes(candidates[idx])) picked.push(candidates[idx]);
      }
      if (picked.length) return picked;
    }
  } catch (e) {}
  return candidates.slice(0, 8);
}

export async function searchCaseLaw(queries) {
  const token = store.clToken;
  const out = [];
  let tried = 0;
  for (const q of queries) {
    if (out.length >= 6 || tried >= 2) break;
    if (!q || q.length < 8) continue;
    tried++;
    try {
      const url = "https://api.courtlistener.com/v3/search/?q=" + encodeURIComponent(q) + "&court=cal+calctapp&type=o&stat_Precedential=on";
      const resp = await fetch(url, { ...(token ? { headers: { Authorization: "Token " + token } } : {}), signal: AbortSignal.timeout(8000) });
      if (!resp.ok) { if (resp.status === 429) break; continue; }
      const data = await resp.json();
      const results = (data && data.results) || [];
      for (const r of results) {
        if (out.length >= 6) break;
        let cite = "";
        try { cite = (r.citations && r.citations[0] && r.citations[0].cite) || ""; } catch (e) {}
        if (out.some((x) => x.caseName === r.caseName)) continue;
        out.push({ caseName: r.caseName || "Unknown case", cite, court: r.court || "", date: r.dateFiled || "",
          snippet: String(r.snippet || "").replace(/<[^>]+>/g, "").slice(0, 700),
          url: r.absolute_url ? "https://www.courtlistener.com" + r.absolute_url : "" });
      }
    } catch (e) { break; }
  }
  if (out.length < 6) {
    try {
      const url2 = "https://api.courtlistener.com/v3/search/?q=" + encodeURIComponent(queries[0]) + "&type=o&stat_Precedential=on";
      const resp2 = await fetch(url2, { ...(token ? { headers: { Authorization: "Token " + token } } : {}), signal: AbortSignal.timeout(8000) });
      if (resp2.ok) {
        const data2 = await resp2.json();
        const results2 = (data2 && data2.results) || [];
        for (const r2 of results2) {
          if (out.length >= 8) break;
          let cite2 = "";
          try { cite2 = (r2.citations && r2.citations[0] && r2.citations[0].cite) || ""; } catch (e) {}
          if (out.some((x) => x.caseName === r2.caseName)) continue;
          out.push({ caseName: r2.caseName || "Unknown case", cite: cite2,
            court: (r2.court || "") + ((r2.court && String(r2.court).indexOf("cal") !== 0) ? " (out-of-state - persuasive only)" : ""),
            date: r2.dateFiled || "",
            snippet: String(r2.snippet || "").replace(/<[^>]+>/g, "").slice(0, 700),
            url: r2.absolute_url ? "https://www.courtlistener.com" + r2.absolute_url : "" });
        }
      }
    } catch (e) {}
  }
  return out;
}

/* ---------- code browser ---------- */
export function buildUnits(abbr) {
  const recs = loaded[abbr] || [];
  const units = [], byPath = {};
  for (const r of recs) {
    if (r.kind === "section") continue;
    const u = { kind: r.kind, number: r.number, title: r.title || "", path: r.path || (r.kind + " " + (r.number || "")), secs: [], children: [] };
    byPath[u.path] = u;
    const pp = u.path.includes(" > ") ? u.path.slice(0, u.path.lastIndexOf(" > ")) : null;
    if (pp && byPath[pp]) byPath[pp].children.push(u); else units.push(u);
  }
  for (const r of recs) { if (r.kind === "section") { const u = byPath[r.path || ""]; if (u) u.secs.push(r); } }
  return units;
}

/* ---------- streaming ---------- */
export async function llmStream(messages, maxTokens, onDelta) {
  const p = getProvider();
  const key = store.key(store.provider);
  if (p.needsKey && !key) throw new Error("NOKEY:" + p.label);
  const resp = await fetch(p.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...p.header(key) },
    body: JSON.stringify({ model: getModel(), messages, max_tokens: maxTokens, stream: true }),
  });
  if (!resp.ok || !resp.body) throw new Error("HTTP " + resp.status);
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "", full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const d = t.slice(5).trim();
      if (d === "[DONE]") continue;
      try {
        const j = JSON.parse(d);
        const c = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
        if (c) { full += c; onDelta(c); }
      } catch (e) {}
    }
  }
  if (!full) throw new Error("EMPTYSTREAM");
  return full;
}

/* ---------- follow-up suggestions ---------- */
export async function suggestFollowUps(q, answer) {
  try {
    const out = await llm([{ role: "user", content:
      "Given this exchange about California law, suggest exactly 3 short follow-up research questions a lawyer would ask next (max 12 words each). Return ONLY a JSON array of 3 strings, no prose.\n\nQuestion: " + q + "\n\nAnswer: " + String(answer).slice(0, 1500) }], 200);
    const arr = parseJsonBlock(out);
    if (Array.isArray(arr)) return arr.map(String).filter((s) => s.length > 3 && s.length < 160).slice(0, 3);
  } catch (e) {}
  return [];
}
