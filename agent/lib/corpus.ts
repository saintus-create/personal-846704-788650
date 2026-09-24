import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

type Section = {
  kind: string;
  section?: string;
  citation?: string;
  text?: string;
  history?: string;
  repealed?: boolean;
};

const lawCache = new Map<string, Section[]>();
const jsonlCache = new Map<string, Array<Record<string, unknown>>>();

function appOrigin(): string {
  const u = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (u) return u.startsWith("http") ? u : `https://${u}`;
  return "http://localhost:3000";
}

async function fetchGz(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function readGz(rel: string): Promise<string> {
  const local = path.join(process.cwd(), "public", rel);
  try {
    return gunzipSync(fs.readFileSync(local)).toString("utf8");
  } catch {
    const buf = await fetchGz(`${appOrigin()}/${rel}`);
    return gunzipSync(buf).toString("utf8");
  }
}

export async function loadCode(abbr: string): Promise<Section[]> {
  const key = abbr.toUpperCase();
  if (lawCache.has(key)) return lawCache.get(key)!;
  const text = await readGz(`corpus/law/${key}.jsonl.gz`);
  const out: Section[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip */ }
  }
  lawCache.set(key, out);
  return out;
}

export async function loadJsonl(rel: string): Promise<Array<Record<string, unknown>>> {
  if (jsonlCache.has(rel)) return jsonlCache.get(rel)!;
  const text = await readGz(rel);
  const out: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip */ }
  }
  jsonlCache.set(rel, out);
  return out;
}

export const CODE_NAMES: Record<string, string> = {
  CONS: "California Constitution", BPC: "Business and Professions Code", CIV: "Civil Code",
  CCP: "Code of Civil Procedure", COM: "Commercial Code", CORP: "Corporations Code",
  EDU: "Education Code", ELEC: "Elections Code", ETD: "Evidence Code", FAM: "Family Code",
  FIN: "Financial Code", FGC: "Fish and Game Code", FAC: "Food and Agricultural Code",
  GOV: "Government Code", HSC: "Health and Safety Code", INS: "Insurance Code",
  LAB: "Labor Code", MIL: "Military and Veterans Code", PEN: "Penal Code",
  PROB: "Probate Code", PUC: "Public Utilities Code", PUBRES: "Public Resources Code",
  PUBCON: "Public Contract Code", RTC: "Revenue and Taxation Code", SHC: "Streets and Highways Code",
  UIC: "Unemployment Insurance Code", VEH: "Vehicle Code", WAT: "Water Code",
  WEL: "Welfare and Institutions Code",
};

const ALL_ABBRS = Object.keys(CODE_NAMES);

export function codesFor(hint?: string[]): string[] {
  if (!hint || !hint.length) return ALL_ABBRS;
  const up = hint.map((c) => c.toUpperCase());
  return ALL_ABBRS.filter((a) => up.includes(a));
}
