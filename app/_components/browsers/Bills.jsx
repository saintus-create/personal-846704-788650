import React, { useEffect, useMemo, useState } from "react";
import { Search, ExternalLink, Landmark, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { loadExtras, extras, extraMeta } from "@/lib/engine";

const GROUP_STYLE = {
  Chaptered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  Active: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-900",
  Enrolled: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  Vetoed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-900",
  Inactive: "bg-muted text-muted-foreground",
};

function GroupBadge({ group }) {
  return (
    <span className={"inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap " +
      (GROUP_STYLE[group] || "bg-muted text-muted-foreground")}>
      {group || "—"}
    </span>
  );
}

function BillRow({ b }) {
  return (
    <div className="p-3.5 hover:bg-muted/40 transition-colors">
      <div className="flex items-start gap-2 flex-wrap">
        <span className="font-semibold text-sm">{b.measure}</span>
        <GroupBadge group={b.group} />
        {b.special && <Badge variant="outline" className="text-[10px] px-1.5 py-0">special session</Badge>}
        {b.fam && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-pink-300 text-pink-700 dark:border-pink-800 dark:text-pink-400">family law</Badge>}
        <span className="text-[11px] text-muted-foreground ml-auto inline-flex items-center gap-1 whitespace-nowrap">
          {b.type}{b.chamber ? " · " + b.chamber : ""}
        </span>
      </div>
      {b.subject && <div className="text-[13px] mt-1.5 leading-relaxed">{b.subject}</div>}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {b.author && (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {b.author}
          </span>
        )}
        {(b.terms || []).slice(0, 5).map((t) => (
          <span key={t} className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{t}</span>
        ))}
        {b.url && (
          <a href={b.url} target="_blank" rel="noopener"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ml-auto">
            Official text <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

export default function Bills() {
  const [ready, setReady] = useState(extras.ready);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const [chamber, setChamber] = useState("all");
  const [group, setGroup] = useState("all");
  const [famOnly, setFamOnly] = useState(false);
  const [shown, setShown] = useState(100);

  useEffect(() => {
    let on = true;
    loadExtras().then((ok) => { if (on) { setReady(extras.bills.length > 0); setFailed(!ok && extras.bills.length === 0); } }).catch(() => on && setFailed(true));
    return () => { on = false; };
  }, []);

  const stats = useMemo(() => {
    if (!ready) return null;
    const s = { total: extras.bills.length, assembly: 0, senate: 0, chaptered: 0, vetoed: 0, active: 0, fam: 0 };
    const groups = new Set();
    for (const b of extras.bills) {
      if (b.chamber === "Assembly") s.assembly++;
      else if (b.chamber === "Senate") s.senate++;
      if (b.group === "Chaptered") s.chaptered++;
      else if (b.group === "Vetoed") s.vetoed++;
      else if (b.group === "Active") s.active++;
      if (b.fam) s.fam++;
      if (b.group) groups.add(b.group);
    }
    s.groups = [...groups].sort();
    return s;
  }, [ready]);

  const filtered = useMemo(() => {
    if (!ready) return [];
    const tokens = applied.toLowerCase().split(/\s+/).filter(Boolean);
    const out = [];
    for (const b of extras.bills) {
      if (chamber !== "all" && b.chamber !== chamber) continue;
      if (group !== "all" && b.group !== group) continue;
      if (famOnly && !b.fam) continue;
      if (tokens.length) {
        const hay = (b.measure + " " + b.subject + " " + b.author + " " + (b.terms || []).join(" ") + " " + b.status).toLowerCase();
        let ok = true;
        for (const t of tokens) if (!hay.includes(t)) { ok = false; break; }
        if (!ok) continue;
      }
      out.push(b);
      if (out.length >= 3000) break;
    }
    return out;
  }, [ready, applied, chamber, group, famOnly]);

  useEffect(() => { setShown(100); }, [applied, chamber, group, famOnly]);

  if (failed) {
    return <div className="p-6 text-sm text-muted-foreground">Bill data could not be loaded. Refresh the page to try again.</div>;
  }
  if (!ready) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the 2025-2026 session bill catalog…
      </div>
    );
  }

  const meta = extraMeta("bills") || {};
  const visible = filtered.slice(0, shown);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="eyebrow"><Landmark className="h-3.5 w-3.5" /> Legislation</div>
      <h1 className="text-2xl font-bold mt-3 mb-1">Bills &amp; Measures — {meta.session || "2025-2026"} Session</h1>
      <p className="text-sm text-muted-foreground">
        Every measure introduced this session, from the official LegInfo bill index
        {meta.retrieved_at ? <> · snapshot {String(meta.retrieved_at).slice(0, 10)}</> : null}.
        {" "}Status tells you where each measure stands — <b>Chaptered</b> means it became law.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-4">
        {[
          [stats.total, "measures"], [stats.assembly, "Assembly"], [stats.senate, "Senate"],
          [stats.chaptered, "chaptered"], [stats.active, "active"], [stats.vetoed, "vetoed"],
        ].map(([v, l]) => (
          <div key={l} className="metric-card !p-2.5">
            <div className="text-lg font-semibold tracking-tight">{Number(v).toLocaleString()}</div>
            <div className="text-[11px] text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mt-5">
        <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); setApplied(query.trim()); }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); if (!e.target.value) setApplied(""); }}
            placeholder="Search subject, author, or measure number (e.g. “insurance wildfire”, “AB 1”)…" className="pl-9 h-11" />
        </form>
        <Select value={chamber} onValueChange={setChamber}>
          <SelectTrigger className="sm:w-36 h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Both chambers</SelectItem>
            <SelectItem value="Assembly">Assembly</SelectItem>
            <SelectItem value="Senate">Senate</SelectItem>
          </SelectContent>
        </Select>
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="sm:w-36 h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {stats.groups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <Switch id="fam-only" checked={famOnly} onCheckedChange={setFamOnly} />
        <Label htmlFor="fam-only" className="text-xs text-muted-foreground cursor-pointer">
          Family-law related only ({stats.fam.toLocaleString()})
        </Label>
        {applied && (
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => { setQuery(""); setApplied(""); }}>
            Clear search
          </Button>
        )}
      </div>

      <div className="mt-4 rounded-xl border divide-y overflow-hidden">
        {visible.map((b, i) => <BillRow key={b.measure + i} b={b} />)}
        {filtered.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground text-center">
            No measures match. Try fewer keywords — the index covers subjects, authors, and measure numbers.
          </div>
        )}
      </div>
      {filtered.length > shown && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setShown(shown + 200)}>
            Show more ({(filtered.length - shown).toLocaleString()} remaining of {filtered.length.toLocaleString()})
          </Button>
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Dated snapshot of the official index — verify status and text at{" "}
        <a className="underline hover:text-foreground" target="_blank" rel="noopener"
          href="https://leginfo.legislature.ca.gov/faces/billSearchClient.xhtml?session_year=20252026">leginfo.legislature.ca.gov</a>.
      </p>
    </div>
  );
}
