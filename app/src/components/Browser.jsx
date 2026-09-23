import React, { useEffect, useState, useRef } from "react";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { loadCorpus, corpusReady, codes, byAbbr, buildUnits } from "@/lib/engine";

function SectionBlock({ s, abbr, filter }) {
  const cite = s.citation || (abbr + " \u00A7 " + s.section);
  const hay = (cite + " " + (s.text || "")).toLowerCase();
  if (filter && !hay.includes(filter)) return null;
  return (
    <div id={"s-" + String(s.section).replace(/[^A-Za-z0-9._-]/g, "_")} className="my-4 scroll-mt-20 rounded px-1 -mx-1 transition-colors">
      <span className="font-semibold text-sm">{cite}</span>
      {s.repealed && <span className="ml-2 text-sm font-semibold text-orange-600 dark:text-orange-400">(Repealed)</span>}
      <div className="text-sm whitespace-pre-wrap mt-1">{(s.text || "").trim()}</div>
      {s.history && <div className="text-xs italic text-muted-foreground mt-1">{s.history}</div>}
    </div>
  );
}

function countMatches(u, filter) {
  let n = 0;
  for (const s of u.secs) {
    const cite = s.citation || (u.abbr + " \u00A7 " + s.section);
    if ((cite + " " + (s.text || "")).toLowerCase().includes(filter)) n++;
  }
  for (const c of u.children) n += countMatches(c, filter);
  return n;
}

function UnitBlock({ u, filter }) {
  if (filter && countMatches(u, filter) === 0) return null;
  const label = u.kind.charAt(0).toUpperCase() + u.kind.slice(1) + " " + (u.number || "") + (u.title ? ". " + u.title : "");
  return (
    <details className="my-2 rounded-lg border" open={!!filter}>
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
        {label}
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {filter ? countMatches(u, filter) + " matches" : u.secs.length + " sections"}
        </span>
      </summary>
      <div className="px-4 pb-3">
        {u.secs.map((s, i) => <SectionBlock key={i} s={s} abbr={u.abbr} filter={filter} />)}
        {u.children.map((c, i) => <UnitBlock key={i} u={c} filter={filter} />)}
      </div>
    </details>
  );
}

export default function Browser({ activeCode, jumpSection, onCodeChange }) {
  const [units, setUnits] = useState(null);
  const [filter, setFilter] = useState("");
  const boxRef = useRef(null);

  useEffect(() => {
    if (!activeCode) return;
    let cancelled = false;
    (async () => {
      setUnits(null);
      if (!corpusReady) await loadCorpus();
      if (!cancelled) setUnits(buildUnits(activeCode).map((u) => ({ ...u, abbr: activeCode })));
    })();
    return () => { cancelled = true; };
  }, [activeCode]);

  useEffect(() => { setFilter(""); }, [activeCode]);

  useEffect(() => {
    if (units && jumpSection) {
      const el = document.getElementById("s-" + String(jumpSection).replace(/[^A-Za-z0-9._-]/g, "_"));
      if (el) {
        let d = el.closest("details");
        while (d) { d.open = true; d = d.parentElement ? d.parentElement.closest("details") : null; }
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("bg-accent");
        setTimeout(() => el.classList.remove("bg-accent"), 2000);
      }
    }
  }, [units, jumpSection]);

  const setAll = (open) => {
    if (boxRef.current) boxRef.current.querySelectorAll("details").forEach((d) => { d.open = open; });
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto" ref={boxRef}>
      <div className="md:hidden mb-4">
        <Select value={activeCode || ""} onValueChange={(v) => onCodeChange(v)}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Choose a code…" /></SelectTrigger>
          <SelectContent>
            {codes.map((c) => <SelectItem key={c.abbr} value={c.abbr}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {!activeCode ? (
        <div>
          <h1 className="text-2xl font-bold mb-2">Browse Codes</h1>
          <p className="text-muted-foreground text-sm">
            The complete California Codes - every section, readable in place. Pick a code to start
            {window.innerWidth >= 768 ? " from the left" : " above"}.
          </p>
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground mb-2">Codes / {byAbbr[activeCode].name}</div>
          <h1 className="text-2xl font-bold">{byAbbr[activeCode].name}</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            <b>{byAbbr[activeCode].sections.toLocaleString()} sections</b> · snapshot updated by source: {byAbbr[activeCode].updated}
          </p>
          {units && (
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={filter} onChange={(e) => setFilter(e.target.value.toLowerCase().trim())}
                  placeholder="Filter sections in this code…" className="pl-8" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAll(true)} className="gap-1.5"><ChevronsUpDown className="h-3.5 w-3.5" /> Expand all</Button>
                <Button variant="outline" size="sm" onClick={() => setAll(false)} className="gap-1.5"><ChevronsDownUp className="h-3.5 w-3.5" /> Collapse</Button>
              </div>
            </div>
          )}
          {units === null ? <p className="text-sm text-muted-foreground">Loading…</p> :
            units.map((u, i) => <UnitBlock key={i} u={u} filter={filter} />)}
          <p className="mt-6 text-xs text-muted-foreground">Dated research snapshot - current official text at leginfo.legislature.ca.gov.</p>
        </>
      )}
    </div>
  );
}
