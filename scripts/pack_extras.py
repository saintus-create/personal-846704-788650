#!/usr/bin/env python3
"""Pack California legislative-info datasets from sibling repos into public/corpus/.

Sources (saintus-create GitHub org):
  family-905324  -> fern/docs/assets/legislation/california-measures-20252026.json  (bills)
                    RULES_OF_COURT.json                                             (court rules)
                    AGENCIES_EXTRACT.json / PUBLIC_RECORDS.json /
                    MUNICIPAL_CONTRACTS_EXTRACT.json                                (directory)
  family-x1oh1xy2-> section_case_map_clean.json / _section_case_map.json /
                    _case_entries.json                                              (case annotations)

Outputs (gzip, consumed by the app in-browser via DecompressionStream):
  public/corpus/legislation/BILLS.jsonl.gz
  public/corpus/rules/ROC.jsonl.gz
  public/corpus/directory/DIRECTORY.json.gz
  public/corpus/cases/FAM_CASES.json.gz
  public/corpus/manifest.json  (adds an "extras" block; "datasets" left intact)

Usage:
  python3 scripts/pack_extras.py --law-repo /path/to/family-905324 \
                                 --case-repo /path/to/family-x1oh1xy2
If the repo paths are omitted they are downloaded from raw.githubusercontent.com.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CORPUS = ROOT / "public" / "corpus"

RAW = "https://raw.githubusercontent.com/saintus-create"
LAW_FILES = {
    "bills": f"{RAW}/family-905324/main/fern/docs/assets/legislation/california-measures-20252026.json",
    "rules": f"{RAW}/family-905324/main/RULES_OF_COURT.json",
    "agencies": f"{RAW}/family-905324/main/AGENCIES_EXTRACT.json",
    "public_records": f"{RAW}/family-905324/main/PUBLIC_RECORDS.json",
    "municipal": f"{RAW}/family-905324/main/MUNICIPAL_CONTRACTS_EXTRACT.json",
}
CASE_FILES = {
    "map_clean": f"{RAW}/family-x1oh1xy2/main/section_case_map_clean.json",
    "map_full": f"{RAW}/family-x1oh1xy2/main/_section_case_map.json",
    "entries": f"{RAW}/family-x1oh1xy2/main/_case_entries.json",
}


def load_json(local: Path | None, url: str):
    if local and local.exists():
        return json.loads(local.read_text(encoding="utf-8"))
    print(f"  downloading {url}", file=sys.stderr)
    req = urllib.request.Request(url, headers={"User-Agent": "ca-leg-info-packer/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def write_gz(path: Path, payload: bytes) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", mtime=0) as f:
        f.write(payload)
    data = buf.getvalue()
    path.write_bytes(data)
    return {"bytes": len(data), "sha256": sha256_bytes(data)}


def jdump(obj) -> bytes:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


# ---------------------------------------------------------------- bills
def pack_bills(src: dict) -> dict:
    records = []
    for r in src["records"]:
        rec = {
            "measure": r["measure"],
            "type": r["measure_type"],
            "chamber": r["chamber"],
            "subject": re.sub(r"\s+", " ", (r.get("subject") or "")).strip(),
            "author": r.get("author") or "",
            "status": r.get("status") or "",
            "group": r.get("status_group") or "",
            "url": r.get("official_url") or "",
        }
        if r.get("special_session"):
            rec["special"] = True
        if r.get("family_law_relevance"):
            rec["fam"] = True
            terms = r.get("family_law_terms") or []
            if terms:
                rec["terms"] = terms
        records.append(rec)
    info = write_gz(CORPUS / "legislation" / "BILLS.jsonl.gz",
                    b"\n".join(jdump(x) for x in records))
    info.update({
        "key": "bills",
        "name": "Bills & Measures — 2025-2026 Session",
        "file": "legislation/BILLS.jsonl.gz",
        "records": len(records),
        "session": src.get("session", "2025-2026"),
        "retrieved_at": src.get("retrieved_at", ""),
        "source": "leginfo.legislature.ca.gov via saintus-create/family-905324",
        "official_source": "https://leginfo.legislature.ca.gov/faces/billSearchClient.xhtml?session_year=20252026",
    })
    return info


# ---------------------------------------------------------------- rules of court
def pack_rules(src: dict) -> dict:
    records = []
    for t in src["titles"]:
        for r in t["rules"]:
            text = (r.get("full_text") or r.get("legal_text") or "").strip()
            if not text:
                continue
            rec = {
                "title": t["title_number"],
                "title_name": t["title_name"],
                "chapter": (r.get("chapter") or "").strip() or None,
                "division": (r.get("division") or "").strip() or None,
                "rule": r["rule_number"].replace("Rule ", "").strip(),
                "rule_title": (r.get("rule_title") or "").strip(),
                "text": text,
                "history": (r.get("history") or "").strip() or None,
            }
            records.append(rec)
    info = write_gz(CORPUS / "rules" / "ROC.jsonl.gz",
                    b"\n".join(jdump(x) for x in records))
    info.update({
        "key": "rules",
        "name": "California Rules of Court",
        "file": "rules/ROC.jsonl.gz",
        "records": len(records),
        "titles": [{"number": t["title_number"], "name": t["title_name"],
                    "rules": len(t["rules"])} for t in src["titles"]],
        "source": "courts.ca.gov via saintus-create/family-905324",
        "official_source": "https://www.courts.ca.gov/cms/rules/index.cfm",
    })
    return info


# ---------------------------------------------------------------- directory
def pack_directory(agencies: list, public_records: dict, municipal: list) -> dict:
    by_id = {}
    for a in agencies:
        by_id[a["id"]] = {
            "id": a["id"], "name": a["name"], "type": a.get("type") or "",
            "county": a.get("county") or "", "post": bool(a.get("post_certified")),
            "funding": a.get("funding") or [], "contracts": a.get("contracts") or [],
            "settlements": a.get("settlements") or [],
        }
    for a in public_records.get("agencies", []):
        cur = by_id.setdefault(a["id"], {"id": a["id"], "name": a["name"], "type": "",
                                         "county": "", "post": False, "funding": [],
                                         "contracts": [], "settlements": []})
        for k_src, k_dst in (("type", "type"), ("county", "county")):
            if a.get(k_src) and not cur.get(k_dst):
                cur[k_dst] = a[k_src]
        if a.get("post_certified"):
            cur["post"] = True
        for k in ("funding", "contracts", "settlements"):
            if a.get(k):
                existing = {json.dumps(x, sort_keys=True) for x in cur[k]}
                cur[k].extend(x for x in a[k] if json.dumps(x, sort_keys=True) not in existing)
    ag_list = sorted(by_id.values(), key=lambda x: x["name"].lower())
    vendors = [{"id": v.get("id"), "name": v.get("name"),
                "services": v.get("services") or [],
                "agencies": v.get("known_contracts") or []} for v in public_records.get("vendors", [])]
    contracts = []
    for m in municipal:
        title = re.sub(r"\s+", " ", (m.get("title") or "")).strip()
        subject = title
        mm = re.match(r"Subject:\s*(.*?)(?:\s*From:|\s*Recommendation:|$)", title, re.I)
        if mm:
            subject = mm.group(1).strip()
        contracts.append({
            "client": m.get("client_id") or "", "vendor": m.get("vendor_keyword") or "",
            "file": m.get("matter_file") or "", "subject": subject[:400],
            "status": m.get("status") or "", "date": (m.get("date") or "")[:10],
            "body": re.sub(r"^\*", "", m.get("body_name") or ""), "url": m.get("url") or "",
        })
    payload = {"agencies": ag_list, "vendors": vendors, "contracts": contracts}
    info = write_gz(CORPUS / "directory" / "DIRECTORY.json.gz", jdump(payload))
    info.update({
        "key": "directory",
        "name": "Agency & Public-Records Directory",
        "file": "directory/DIRECTORY.json.gz",
        "agencies": len(ag_list), "vendors": len(vendors), "contracts": len(contracts),
        "source": "saintus-create/family-905324 (AGENCIES_EXTRACT, PUBLIC_RECORDS, MUNICIPAL_CONTRACTS)",
    })
    return info


# ---------------------------------------------------------------- case annotations
def fam_section_set() -> set:
    """Section numbers that actually exist in the bundled FAM corpus."""
    path = CORPUS / "law" / "FAM.jsonl.gz"
    secs = set()
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            if r.get("kind") == "section" and r.get("section"):
                secs.add(str(r["section"]))
    return secs


def code_section_exists(abbr: str, section: str) -> bool:
    path = CORPUS / "law" / f"{abbr}.jsonl.gz"
    if not path.exists():
        return False
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            if f'"section":"{section}"' in line.replace(" ", ""):
                return True
    return False


# Clean-map keys that are not Family Code sections. Each of these cases turns on a
# Code of Civil Procedure provision: Parris J. v. Christopher U. (statement of
# decision requests -> CCP 632/634), Michael K. v. Cho (anti-SLAPP -> CCP 425.16),
# Hatley v. Southard (judgment in a court trial -> CCP 631.8).
NON_FAM_KEYS = {"425.16": "CCP", "631.8": "CCP", "632": "CCP", "634": "CCP"}


def clean_desc(text: str) -> str:
    """Normalize whitespace and strip DV-guide internal cross-reference prefixes."""
    text = re.sub(r"\s+", " ", text or "").strip()
    text = re.sub(r"^(?:See\s+sections?\s+[A-Z0-9()&\s,.]+?above\.\s*)+", "", text)
    return text.strip()


def pack_cases(map_clean: dict, map_full: dict, entries: list) -> dict:
    full_by_name = {}
    for e in entries:
        full_by_name.setdefault((e.get("name") or "").strip().lower(), e)

    def enrich(case: dict) -> dict:
        name = (case.get("name") or "").strip()
        full = full_by_name.get(name.lower())
        desc = clean_desc((full or {}).get("description") or case.get("description") or "")
        return {"name": name,
                "year": case.get("year") or (full or {}).get("year") or "",
                "cite": (full or {}).get("citation") or case.get("citation") or "",
                "desc": desc}

    fam_secs = fam_section_set()
    fam, other, ranges, unresolved = {}, {}, {}, {}
    seen_pairs = set()

    def add(bucket_key: str, case: dict, target: dict):
        if not case["desc"]:
            return
        key = (bucket_key, case["name"].lower())
        if key in seen_pairs:
            return
        seen_pairs.add(key)
        target.setdefault(bucket_key, []).append(case)

    for source, trusted in ((map_clean, True), (map_full, False)):
        for sec, cases in source.items():
            sec = str(sec).strip()
            if not isinstance(cases, list) or not cases:
                continue
            enriched = [enrich(c) for c in cases if (c.get("name") or "").strip()]
            if not trusted:
                # noisy map: require the case to be one of the curated entries
                enriched = [c for c in enriched if c["name"].lower() in full_by_name]
            if not enriched:
                continue
            rng = re.fullmatch(r"(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)", sec)
            if rng:
                for c in enriched:
                    add(sec, c, ranges)
            elif sec in fam_secs:
                for c in enriched:
                    add(sec, c, fam)
            elif sec in NON_FAM_KEYS and code_section_exists(NON_FAM_KEYS[sec], sec):
                for c in enriched:
                    add(f"{NON_FAM_KEYS[sec]} {sec}", c, other)
            else:
                for c in enriched:
                    add(sec, c, unresolved)
    payload = {
        "fam": fam,
        "other": other,
        "ranges": ranges,
        "unresolved": unresolved,
        "cases": [enrich({"name": e.get("name"), "year": e.get("year"),
                          "citation": e.get("citation"), "description": e.get("description")})
                  for e in entries if (e.get("name") or "").strip()],
    }
    info = write_gz(CORPUS / "cases" / "FAM_CASES.json.gz", jdump(payload))
    info.update({
        "key": "famcases",
        "name": "Case Annotations — Family Code & DVPA",
        "file": "cases/FAM_CASES.json.gz",
        "sections_annotated": len(fam),
        "other_sections": len(other),
        "ranges": len(ranges),
        "cases": len(payload["cases"]),
        "source": "saintus-create/family-x1oh1xy2 (curated DVPA case summaries)",
    })
    return info


# ---------------------------------------------------------------- manifest
def update_manifest(extras: list) -> None:
    path = CORPUS / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["extras"] = {
        "format": "fern-corpus-extras-v1",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "datasets": extras,
    }
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--law-repo", type=Path, default=None,
                    help="local checkout of saintus-create/family-905324")
    ap.add_argument("--case-repo", type=Path, default=None,
                    help="local checkout of saintus-create/family-x1oh1xy2")
    args = ap.parse_args()

    law, case = args.law_repo, args.case_repo

    def lawfile(name: str, rel: str) -> dict:
        return load_json(law / rel if law else None, LAW_FILES[name])

    def casefile(name: str, rel: str) -> dict:
        return load_json(case / rel if case else None, CASE_FILES[name])

    print("Packing bills…", file=sys.stderr)
    bills = pack_bills(lawfile("bills", "fern/docs/assets/legislation/california-measures-20252026.json"))
    print(f"  {bills['records']} measures -> {bills['bytes']:,} bytes gz", file=sys.stderr)

    print("Packing rules of court…", file=sys.stderr)
    rules = pack_rules(lawfile("rules", "RULES_OF_COURT.json"))
    print(f"  {rules['records']} rules -> {rules['bytes']:,} bytes gz", file=sys.stderr)

    print("Packing directory…", file=sys.stderr)
    directory = pack_directory(
        lawfile("agencies", "AGENCIES_EXTRACT.json"),
        lawfile("public_records", "PUBLIC_RECORDS.json"),
        lawfile("municipal", "MUNICIPAL_CONTRACTS_EXTRACT.json"),
    )
    print(f"  {directory['agencies']} agencies, {directory['vendors']} vendors, "
          f"{directory['contracts']} contracts -> {directory['bytes']:,} bytes gz", file=sys.stderr)

    print("Packing case annotations…", file=sys.stderr)
    cases = pack_cases(
        casefile("map_clean", "section_case_map_clean.json"),
        casefile("map_full", "_section_case_map.json"),
        casefile("entries", "_case_entries.json"),
    )
    print(f"  {cases['sections_annotated']} FAM sections + {cases['other_sections']} other, "
          f"{cases['cases']} cases -> {cases['bytes']:,} bytes gz", file=sys.stderr)

    for e in (bills, rules, directory, cases):
        e.pop("bytes", None)
    update_manifest([bills, rules, directory, cases])
    print("manifest.json updated.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
