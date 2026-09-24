import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, ChevronsUpDown, ChevronsDownUp, Search, ExternalLink, Gavel, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadExtras, extras, extraMeta } from "@/lib/engine";

function RuleBlock({ r, filter }) {
  const hay = (r.rule + " " + (r.rule_title || "") + " " + (r.text || "")).toLowerCase();
  if (filter && !hay.includes(filter)) return null;
  return (
    <div id={"rule-" + String(r.rule).replace(/[^A-Za-z0-9._-]/g, "_")}
      className="my-4 scroll-mt-20 rounded px-1 -mx-1 transition-colors">
      <span className="font-semibold text-sm">Rule {r.rule}{r.rule_title ? ". " + r.rule_title : ""}</span>
      <div className="text-sm whitespace-pre-wrap mt-1">{(r.text || "").trim()}</div>
      {r.history && <div className="text-xs italic text-muted-foreground mt-1">{r.history}</div>}
    </div>
  );
}

function countRuleMatches(group, filter) {
  let n = 0;
  for (const r of group.rules) {
    const hay = (r.rule + " " + (r.rule_title || "") + " " + (r.text || "")).toLowerCase();
    if (hay.includes(filter)) n++;
  }
  return n;
}

function ChapterBlock({ g, filter }) {
  if (filter && countRuleMatches(g, filter) === 0) return null;
  return (
    <details className="my-2 rounded-lg border" open={!!filter}>
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
        {g.label}
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {filter ? countRuleMatches(g, filter) + " matches" : g.rules.length + " rules"}
        </span>
      </summary>
      <div className="px-4 pb-3">
        {g.rules.map((r, i) => <RuleBlock key={i} r={r} filter={filter} />)}
      </div>
    </details>
  );
}

export default function Rules({ jumpRule }) {
  const [ready, setReady] = useState(extras.rules.length > 0);
  const [failed, setFailed] = useState(false);
  const [titleNum, setTitleNum] = useState(null);
  const [filter, setFilter] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalResults, setGlobalResults] = useState([]);
  const [focus, setFocus] = useState(null);   // {rule, n} - scroll target
  const boxRef = useRef(null);

  useEffect(() => {
    let on = true;
    loadExtras().then((ok) => { if (on) { setReady(extras.rules.length > 0); setFailed(!ok && extras.rules.length === 0); } }).catch(() => on && setFailed(true));
    return () => { on = false; };
  }, []);

  // jump-to-rule from chat citations (App passes {rule, n})
  useEffect(() => { if (jumpRule) setFocus(jumpRule); }, [jumpRule]);

  const titles = useMemo(() => {
    if (!ready) return [];
    const byTitle = new Map();
    for (const r of extras.rules) {
      if (!byTitle.has(r.title)) byTitle.set(r.title, { number: r.title, name: r.title_name, rules: [] });
      byTitle.get(r.title).rules.push(r);
    }
    const meta = extraMeta("rules");
    const declared = (meta && meta.titles) || [];
    const out = [];
    for (const t of declared) {
      const built = byTitle.get(t.number) || { number: t.number, name: t.name, rules: [] };
      out.push(built);
    }
    for (const [num, built] of byTitle) if (!declared.some((t) => t.number === num)) out.push(built);
    out.sort((a, b) => a.number - b.number);
    return out;
  }, [ready]);

  const groups = useMemo(() => {
    if (titleNum == null) return [];
    const t = titles.find((x) => x.number === titleNum);
    if (!t) return [];
    const byKey = new Map();
    for (const r of t.rules) {
      const parts = [r.chapter || "General provisions"];
      if (r.division) parts.push(r.division);
      const key = parts.join(" > ");
      if (!byKey.has(key)) byKey.set(key, { label: key, rules: [] });
      byKey.get(key).rules.push(r);
    }
    return [...byKey.values()];
  }, [titles, titleNum]);

  // when a focus target is set: switch to its title, then scroll once rendered
  useEffect(() => {
    if (!ready || !focus) return;
    const target = extras.rules.find((r) => String(r.rule) === String(focus.rule));
    if (target && titleNum !== target.title) setTitleNum(target.title);
  }, [ready, focus, titleNum]);

  useEffect(() => {
    if (!ready || !focus || titleNum == null) return;
    const el = document.getElementById("rule-" + String(focus.rule).replace(/[^A-Za-z0-9._-]/g, "_"));
    if (el) {
      let d = el.closest("details");
      while (d) { d.open = true; d = d.parentElement ? d.parentElement.closest("details") : null; }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-accent");
      setTimeout(() => el.classList.remove("bg-accent"), 2000);
    }
  }, [ready, groups, focus, titleNum]);

  const setAll = (open) => {
    if (boxRef.current) boxRef.current.querySelectorAll("details").forEach((d) => { d.open = open; });
  };

  const runGlobalSearch = (e) => {
    e.preventDefault();
    const q = globalQuery.trim().toLowerCase();
    if (!q) return;
    const tokens = q.split(/\s+/).filter(Boolean);
    const out = [];
    for (const r of extras.rules) {
      const hay = (r.rule + " " + (r.rule_title || "") + " " + (r.text || "")).toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (!hay.includes(t)) { score = -1; break; }
        score += (r.rule_title || "").toLowerCase().includes(t) ? 2 : 1;
      }
      if (q.includes("rule " + r.rule) || q === r.rule) score += 50;
      if (score > 0) out.push({ r, score });
    }
    out.sort((a, b) => b.score - a.score);
    setGlobalResults(out.slice(0, 30).map((x) => x.r));
  };

  if (failed) {
    return <div className="p-6 text-sm text-muted-foreground">Rules data could not be loaded. Refresh the page to try again.</div>;
  }
  if (!ready) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the California Rules of Court…
      </div>
    );
  }

  const meta = extraMeta("rules") || {};
  const total = meta.records || extras.rules.length;
  const activeTitle = titles.find((x) => x.number === titleNum);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto" ref={boxRef}>
      {titleNum == null ? (
        <div>
          <div className="eyebrow"><Gavel className="h-3.5 w-3.5" /> Judicial Council</div>
          <h1 className="text-2xl font-bold mt-3 mb-2">California Rules of Court</h1>
          <p className="text-muted-foreground text-sm">
            <b>{Number(total).toLocaleString()} rules</b> across {titles.length} titles — the procedural rules that govern
            California's trial and appellate courts, searchable in full. Pick a title, or search every rule.
          </p>
          <form onSubmit={runGlobalSearch} className="mt-5 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={globalQuery} onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Search all rules (e.g. “continuance”, “service of papers”, “rule 8.1115”)…" className="pl-9 h-11" />
            </div>
            <Button type="submit" className="h-11">Search</Button>
          </form>
          {globalResults.length > 0 && (
            <div className="mt-4 rounded-xl border divide-y overflow-hidden">
              {globalResults.map((r, i) => (
                <button key={i} onClick={() => { setGlobalResults([]); setGlobalQuery(""); setFilter(""); setFocus({ rule: r.rule, n: Date.now() }); }}
                  className="w-full text-left p-3 hover:bg-muted/40 transition-colors">
                  <div className="text-sm font-semibold">Rule {r.rule}{r.rule_title ? ". " + r.rule_title : ""}</div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.text}</div>
                  <div className="text-[11px] text-muted-foreground mt-1.5">{r.title_name}{r.chapter ? " · " + r.chapter : ""}</div>
                </button>
              ))}
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            {titles.map((t) => (
              <button key={t.number} onClick={() => t.rules.length && setTitleNum(t.number)}
                disabled={!t.rules.length}
                className="metric-card text-left disabled:opacity-50 hover:border-foreground/30 transition-colors">
                <div className="text-sm font-semibold">{t.name || "Title " + t.number}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t.rules.length ? t.rules.length.toLocaleString() + " rules" : "Reserved — no rules"}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Dated snapshot — current official text at{" "}
            <a className="underline hover:text-foreground" href="https://www.courts.ca.gov/cms/rules/index.cfm" target="_blank" rel="noopener">courts.ca.gov</a>.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <button className="hover:text-foreground inline-flex items-center gap-1" onClick={() => { setTitleNum(null); setFilter(""); }}>
              <ArrowLeft className="h-3 w-3" /> Rules of Court
            </button>
            <span>/</span>
            <span>{activeTitle ? activeTitle.name : "Title " + titleNum}</span>
          </div>
          <h1 className="text-2xl font-bold">{activeTitle ? activeTitle.name : "Title " + titleNum}</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            <b>{activeTitle ? activeTitle.rules.length.toLocaleString() : 0} rules</b>
            {" "}· <a href="https://www.courts.ca.gov/cms/rules/index.cfm" target="_blank" rel="noopener"
              className="inline-flex items-center gap-1 hover:text-foreground">Verify at official California Courts <ExternalLink className="h-3 w-3" /></a>
          </p>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={filter} onChange={(e) => setFilter(e.target.value.toLowerCase().trim())}
                placeholder="Filter rules in this title…" className="pl-8" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAll(true)} className="gap-1.5"><ChevronsUpDown className="h-3.5 w-3.5" /> Expand all</Button>
              <Button variant="outline" size="sm" onClick={() => setAll(false)} className="gap-1.5"><ChevronsDownUp className="h-3.5 w-3.5" /> Collapse</Button>
            </div>
          </div>
          {groups.map((g, i) => <ChapterBlock key={i} g={g} filter={filter} />)}
          <p className="mt-6 text-xs text-muted-foreground">Dated snapshot — current official text at courts.ca.gov.</p>
        </>
      )}
    </div>
  );
}
