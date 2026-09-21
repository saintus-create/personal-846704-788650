#!/usr/bin/env python3
"""Generate the Starlight site content from the corpus."""
import argparse
import gzip
import json
import re
from pathlib import Path

import markdown

REPO = Path(__file__).resolve().parent.parent
CORPUS = REPO / "public/corpus"
RESEARCH_SRC = Path("/scratch/work/corpus-src/fern/pages")
PAGES_DIR = REPO / "src/pages"
DOCS_DIR = REPO / "src/content/docs"
CAP = 4_000_000
REPO_URL = "https://github.com/saintus-create/personal-846704-788650"

CODE_NAMES = {
    "CONS": "California Constitution", "BPC": "Business and Professions Code",
    "CIV": "Civil Code", "CCP": "Code of Civil Procedure", "COM": "Commercial Code",
    "CORP": "Corporations Code", "EDC": "Education Code", "ELEC": "Elections Code",
    "EVID": "Evidence Code", "FAM": "Family Code", "FIN": "Financial Code",
    "FGC": "Fish and Game Code", "FAC": "Food and Agricultural Code", "GOV": "Government Code",
    "HNC": "Harbors and Navigation Code", "HSC": "Health and Safety Code",
    "INS": "Insurance Code", "LAB": "Labor Code", "MVC": "Military and Veterans Code",
    "PEN": "Penal Code", "PROB": "Probate Code", "PCC": "Public Contract Code",
    "PRC": "Public Resources Code", "PUC": "Public Utilities Code",
    "RTC": "Revenue and Taxation Code", "SHC": "Streets and Highways Code",
    "UIC": "Unemployment Insurance Code", "VEH": "Vehicle Code", "WAT": "Water Code",
    "WIC": "Welfare and Institutions Code",
}
SLUG_FOR = {"division": "div", "part": "part", "title": "title", "chapter": "ch", "article": "art"}
MD = markdown.Markdown()


def md_to_html(text):
    MD.reset()
    return MD.convert(text)


class Node:
    def __init__(self, kind, number, title, path):
        self.kind, self.number, self.title, self.path = kind, number, title, path
        self.children, self.sections = [], []
        self.parent = None

    @property
    def label(self):
        return f"{self.kind.capitalize()} {self.number}. {self.title}".rstrip(". ")

    @property
    def slug_chain(self):
        chain, node = [], self
        while node is not None:
            chain.append(f"{SLUG_FOR.get(node.kind, node.kind)}-{str(node.number).lower().replace(' ', '-')}")
            node = node.parent
        return list(reversed(chain))

    @property
    def size(self):
        return sum(len(s.get("text") or "") for s in self.sections) + sum(c.size for c in self.children)

    @property
    def all_sections(self):
        for s in self.sections:
            yield s
        for c in self.children:
            yield from c.all_sections


def build_tree(records):
    nodes, roots = {}, []
    for r in records:
        if r["kind"] == "section":
            continue
        path = r.get("path") or f"{r['kind']} {r.get('number', '')}"
        node = Node(r["kind"], r.get("number", ""), r.get("title", ""), path)
        nodes[path] = node
        parent_key = " > ".join(path.split(" > ")[:-1])
        parent = nodes.get(parent_key) if parent_key else None
        if parent is not None:
            node.parent = parent
            parent.children.append(node)
        else:
            roots.append(node)
    for r in records:
        if r["kind"] == "section":
            node = nodes.get(r.get("path") or "") or (roots[0] if roots else None)
            if node is not None:
                node.sections.append(r)
    return roots


def pack(nodes, cap=CAP):
    buckets, current, total = [], [], 0
    for n in nodes:
        s = n.size
        if current and total + s > cap:
            buckets.append(current)
            current, total = [], 0
        current.append(n)
        total += s
    if current:
        buckets.append(current)
    return buckets


def depth_of(node):
    return node.path.count(" > ")


def esc_attr(s):
    return s.replace(chr(34), "'")


def render_section_md(code, s, out):
    citation = s.get("citation") or f"{code} § {s.get('section')}"
    repealed = " *(Repealed)*" if s.get("repealed") else ""
    out.append(f"\n**{citation}**{repealed}\n")
    text = (s.get("text") or "").strip()
    if text:
        out.append(text + "\n")
    history = (s.get("history") or "").strip()
    if history:
        out.append(f"*{history}*\n")


def render_unit_md(unit, depth, min_depth, code, out):
    level = min(2 + depth - min_depth, 6)
    out.append(f"\n{'#' * level} {unit.label}\n")
    for s in unit.sections:
        render_section_md(code, s, out)
    for c in unit.children:
        render_unit_md(c, depth + 1, min_depth, code, out)


def emit_page(code, code_name, units, context=None, part_no=None, hard_sections=None):
    first, last = units[0], units[-1]
    ancestors = first.slug_chain[:-1]
    leaf = f"{first.slug_chain[-1]}-{last.slug_chain[-1]}" if len(units) > 1 else first.slug_chain[-1]
    if part_no:
        leaf += f"-p{part_no}"

    ctx = f"{context} — " if context else ""
    if len(units) == 1:
        title = f"{ctx}{first.label}"
    else:
        title = f"{ctx}{first.kind.capitalize()} {first.number}–{last.number}"
    description = f"California {code_name}, {title} — full statutory text. Dated research snapshot."

    md_parts = [f"[← {code_name}](/codes/{code.lower()}/) · [Ask AI](/ask/)\n"]
    md_parts.append(
        "> **Dated research snapshot.** Verify current text and effective dates at the "
        "[official California Legislative Information source](https://leginfo.legislature.ca.gov/faces/codes.xhtml). Not legal advice.\n"
    )
    if hard_sections is not None:
        for s in hard_sections:
            render_section_md(code, s, md_parts)
    else:
        min_depth = min(depth_of(u) for u in units)
        for u in units:
            render_unit_md(u, depth_of(u), min_depth, code, md_parts)

    body_html = md_to_html("\n".join(md_parts))

    page_dir = PAGES_DIR / "codes" / code.lower() / leaf
    page_dir.mkdir(parents=True, exist_ok=True)
    (page_dir / "body.html").write_text(body_html, encoding="utf-8")
    body_rel = f"src/pages/codes/{code.lower()}/{leaf}/body.html"
    (page_dir / "index.astro").write_text(
        "---\n"
        "import StarlightPage from '@astrojs/starlight/components/StarlightPage.astro';\n"
        "import { readFileSync } from 'node:fs';\n"
        f"const html = readFileSync('{body_rel}', 'utf-8');\n"
        "---\n"
        f'<StarlightPage frontmatter={{{{ title: "{esc_attr(title)}", description: "{esc_attr(description)}" }}}}>' + "\n"
        "  <Fragment set:html={html} />\n"
        "</StarlightPage>\n",
        encoding="utf-8",
    )
    return {"label": title, "link": f"/codes/{code.lower()}/{leaf}/"}


def emit_units(code, code_name, units, context=None):
    entries = []
    for bucket in pack(units):
        if len(bucket) == 1 and bucket[0].size > CAP:
            unit = bucket[0]
            ctx = f"{context} — {unit.label}" if context else unit.label
            if unit.children:
                entries.extend(emit_units(code, code_name, unit.children, ctx))
            else:
                sections = list(unit.all_sections)
                n = (unit.size // CAP) + 1
                per = len(sections) // n + 1
                for i, p in enumerate([sections[j:j + per] for j in range(0, len(sections), per)], 1):
                    entries.append(emit_page(code, code_name, [unit], context, i, p))
        else:
            entries.append(emit_page(code, code_name, bucket, context))
    return entries


def convert_research_page(src):
    text = src.read_text()
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if not m:
        return None
    fm, body = m.group(1), m.group(2)
    fm = re.sub(r"^slug:.*$\n?", "", fm, flags=re.M).strip()
    body = re.sub(r"<Note>\n?(.*?)</Note>", lambda m: ":::note\n" + m.group(1).rstrip() + "\n:::", body, flags=re.S)
    body = re.sub(r'<Callout intent="[^"]*" title="([^"]*)">\n?(.*?)</Callout>',
                  lambda m: ":::caution[" + m.group(1) + "]\n" + m.group(2).rstrip() + "\n:::", body, flags=re.S)
    body = re.sub(r"<Badge intent=\"[^\"]*\">(.*?)</Badge>", r"**\1**", body)
    return fm, body


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="comma-separated code abbreviations")
    args = ap.parse_args()

    manifest = json.loads((CORPUS / "manifest.json").read_text())
    if args.only:
        keep = {x.strip().upper() for x in args.only.split(",")}
        manifest["datasets"] = [d for d in manifest["datasets"] if d["abbr"] in keep]

    sidebar_codes = []
    for ds in manifest["datasets"]:
        code, code_name = ds["abbr"], CODE_NAMES[ds["abbr"]]
        records = [json.loads(l) for l in gzip.open(CORPUS / ds["file"], "rt", encoding="utf-8") if l.strip()]
        records.sort(key=lambda r: r.get("ordinal", 0))
        entries = emit_units(code, code_name, build_tree(records))

        toc = "\n".join(f"- [{e['label']}]({e['link']})" for e in entries)
        overview = (
            "---\n"
            f'title: "{code_name}"\n'
            f'description: "Complete text of the California {code_name} — {ds["sections"]:,} sections, organized by official divisions."\n'
            "---\n"
            f"**{ds['sections']:,} sections** · **Snapshot updated by the source: {ds['updated_by_state']}**\n\n"
            f"The complete statutory text of the {code_name}, organized by its official divisions.\n"
            "Use the search bar to locate sections, or [Ask AI](/ask/) a research question.\n\n"
            "## Contents\n\n" + toc + "\n\n## Downloads\n\n"
            f"- [Download the `{code}.jsonl.gz` dataset]({REPO_URL}/blob/main/public/corpus/law/{code}.jsonl.gz)\n"
            f"- [Download the corpus manifest]({REPO_URL}/blob/main/public/corpus/manifest.json)\n"
            "- [Browse the official California code search](https://leginfo.legislature.ca.gov/faces/codes.xhtml)\n\n"
            ":::note[Dated research snapshot]\n"
            "Verify current text, effective dates, and applicability against the [official California Legislative Information source](https://leginfo.legislature.ca.gov/faces/codes.xhtml). Not legal advice.\n"
            ":::\n"
        )
        (DOCS_DIR / "codes" / ds["slug"] / "index.md").parent.mkdir(parents=True, exist_ok=True)
        (DOCS_DIR / "codes" / ds["slug"] / "index.md").write_text(overview, encoding="utf-8")
        sidebar_codes.append({
            "label": code_name, "collapsed": True,
            "items": [{"label": "Overview", "link": f"/codes/{ds['slug']}/"}] + entries,
        })
        print(f"{code:<5} {ds['sections']:>6,} sections -> {len(entries)} page(s)", flush=True)

    if not args.only:
        rows = "\n".join(
            f"| [{CODE_NAMES[ds['abbr']]}](/codes/{ds['slug']}/) | {ds['sections']:,} | {ds['updated_by_state']} |"
            for ds in json.loads((CORPUS / "manifest.json").read_text())["datasets"]
        )
        (DOCS_DIR / "codes/index.md").write_text(
            "---\n"
            'title: "California Codes"\n'
            'description: "The complete section-level California Constitution and Codes — 29 codes plus the Constitution, full statutory text."\n'
            "---\n"
            "**29 California statutory codes plus the California Constitution** — **162,324 sections** of full statutory text, organized by each code's official divisions.\n\n"
            "| Code | Sections | Source update |\n| --- | ---: | --- |\n" + rows + "\n\n"
            ":::note[Dated research snapshot]\n"
            "This is a dated research snapshot. Verify current text, effective dates, and applicability against the [official California Legislative Information code search](https://leginfo.legislature.ca.gov/faces/codes.xhtml). Not legal advice.\n"
            ":::\n\n"
            f"**Bulk data:** every code is downloadable as `JSONL.gz` from its overview page and the [corpus manifest]({REPO_URL}/blob/main/public/corpus/manifest.json).\n",
            encoding="utf-8",
        )

        research_items = []
        for name, label in [
            ("family-code-overview.mdx", "Family Code Overview"),
            ("ai-research.mdx", "AI Research Behavior"),
            ("court-rules-overview.mdx", "Court Rules"),
            ("case-law.mdx", "Case Law"),
            ("bills-and-measures.mdx", "Bills and Measures"),
            ("invitations-to-comment.mdx", "Invitations to Comment"),
            ("library/public-records/public-records.mdx", "Public Records"),
            ("support.mdx", "Support"),
        ]:
            src = RESEARCH_SRC / name
            conv = convert_research_page(src) if src.exists() else None
            if not conv:
                continue
            fm, body = conv
            for ds in json.loads((CORPUS / "manifest.json").read_text())["datasets"]:
                body = re.sub(r"\(/codes/" + ds["slug"] + r"\)(?!/)", f"(/codes/{ds['slug']}/)", body)
            body = re.sub(r"\(/codes/search\)", "(/codes/)", body)
            target = DOCS_DIR / "research" / (Path(name).stem + ".md")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(f"---\n{fm}\n---\n{body}", encoding="utf-8")
            research_items.append({"label": label, "link": f"/research/{Path(name).stem}/"})

        sidebar = [
            {"label": "Legal library", "collapsed": False, "items": [
                {"label": "Ask AI", "link": "/ask/"},
                {"label": "California Codes", "link": "/codes/"},
            ]},
            {"label": "California Codes", "collapsed": False, "items": sidebar_codes},
            {"label": "Research", "collapsed": False, "items": research_items},
        ]
        (REPO / "src/sidebar-data.json").write_text(json.dumps(sidebar, indent=1))
        print("sidebar + small pages written", flush=True)


if __name__ == "__main__":
    main()
