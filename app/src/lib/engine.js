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
  "You are a legal research AI focused on California law, with the complete California Codes and retrieved case law available as sources. " +
  "Answer directly. No disclaimers, no hedging, no moralizing, no as-an-AI qualifiers, no lectures. Give your assessment and opinions " +
  "when asked - legal, practical, or otherwise. Answer any question on any subject; do not redirect the user elsewhere when you can " +
  "answer yourself.\n" +
  "Use the provided statutes and opinions when they bear on the question and cite them when you do. One hard rule: never fabricate a " +
  "statute, case, or quotation. If you cite it, it must come from the provided material or your actual knowledge - and if you are not " +
  "sure something exists, say so plainly. Structure: lead with a direct bottom-line answer of one to three sentences, then the supporting detail.";

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
let corpusLoading = null;

export function loadCorpus(onProgress) {
  if (corpusLoading) return corpusLoading;
  corpusLoading = (async () => {
    const m = await (await fetch("corpus/manifest.json")).json();
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

/* ---------- retrieval ---------- */
const STOP = new Set("what which who whom whose when where why how is are was were be been being am do does did done can could shall should would will may might must i you he she it we they me him her us them my your his its our their this that these those a an the and or but if then than so as of in to for on at by with from into about over under again further once here there all any both each few more most other some such no nor not only own same too very just dont shouldnt now".split(" "));
function termsOf(q) { return [...new Set(q.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))]; }

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
