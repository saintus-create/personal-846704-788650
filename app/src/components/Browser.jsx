import React, { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { loadCorpus, corpusReady, codes, byAbbr, loaded, buildUnits } from "@/lib/engine";

function SectionBlock({ s, abbr }) {
  const cite = s.citation || (abbr + " § " + s.section);
  return (
    <div id={"s-" + String(s.section).replace(/[^A-Za-z0-9._-]/g, "_")} className="my-4 scroll-mt-20">
      <span className="font-semibold text-sm">{cite}</span>
      {s.repealed && <span className="ml-2 text-sm font-semibold text-orange-600 dark:text-orange-400">(Repealed)</span>}
      <div className="text-sm whitespace-pre-wrap mt-1">{(s.text || "").trim()}</div>
      {s.history && <div className="text-xs italic text-muted-foreground mt-1">{s.history}</div>}
    </div>
  );
}

function UnitBlock({ u }) {
  const label = u.kind.charAt(0).toUpperCase() + u.kind.slice(1) + " " + (u.number || "") + (u.title ? ". " + u.title : "");
  return (
    <details className="my-2 rounded-lg border">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold flex items-center gap-1 list-none">
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
        {label}
        <span className="ml-auto text-xs font-normal text-muted-foreground">{u.secs.length} sections</span>
      </summary>
      <div className="px-4 pb-3">
        {u.secs.map((s, i) => <SectionBlock key={i} s={s} abbr={u.abbr} />)}
        {u.children.map((c, i) => <UnitBlock key={i} u={c} />)}
      </div>
    </details>
  );
}

export default function Browser({ activeCode, jumpSection }) {
  const [units, setUnits] = useState(null);

  useEffect(() => {
    if (!activeCode) return;
    let cancelled = false;
    (async () => {
      setUnits(null);
      if (!corpusReady) await loadCorpus();
      if (!cancelled) {
        const us = buildUnits(activeCode).map((u) => ({ ...u, abbr: activeCode }));
        setUnits(us);
      }
    })();
    return () => { cancelled = true; };
  }, [activeCode]);

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

  if (!activeCode) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Browse Codes</h1>
        <p className="text-muted-foreground text-sm">Pick a code on the left.</p>
      </div>
    );
  }
  const c = byAbbr[activeCode];
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="text-xs text-muted-foreground mb-2">Codes / {c.name}</div>
      <h1 className="text-2xl font-bold">{c.name}</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        <b>{c.sections.toLocaleString()} sections</b> · snapshot updated by source: {c.updated}
      </p>
      {units === null ? <p className="text-sm text-muted-foreground">Loading…</p> :
        units.map((u, i) => <UnitBlock key={i} u={u} />)}
      <p className="mt-6 text-xs text-muted-foreground">Dated research snapshot - current official text at leginfo.legislature.ca.gov.</p>
    </div>
  );
}
