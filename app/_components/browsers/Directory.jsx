import React, { useEffect, useMemo, useState } from "react";
import { Search, ExternalLink, Building2, Loader2, ShieldCheck, BadgeCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { loadExtras, extras, extraMeta } from "@/lib/engine";

function money(n) {
  if (n == null) return "";
  const v = Number(n);
  if (isNaN(v)) return String(n);
  return "$" + v.toLocaleString();
}

function AgencyRow({ a }) {
  const detail = (a.contracts || []).length + (a.funding || []).length + (a.settlements || []).length > 0;
  return (
    <details className="border-b last:border-b-0" open={false}>
      <summary className={"px-3.5 py-2.5 flex items-center gap-2 text-sm " + (detail ? "cursor-pointer hover:bg-muted/40" : "cursor-default")}
        onClick={(e) => { if (!detail) e.preventDefault(); }}>
        <span className="font-medium">{a.name}</span>
        {a.post && <BadgeCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-label="POST certified" />}
        <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground whitespace-nowrap">
          {a.county && a.county !== "Unknown" ? a.county + " County" : ""}
          <span className="rounded-full bg-muted px-2 py-0.5">{a.type || "Agency"}</span>
        </span>
      </summary>
      {detail && (
        <div className="px-3.5 pb-3 text-xs space-y-2">
          {(a.contracts || []).length > 0 && (
            <div>
              <div className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-1">Contracts</div>
              {a.contracts.map((c, i) => (
                <div key={i} className="rounded-md border p-2 mb-1">
                  <div className="font-medium text-foreground">{c.vendor}{c.amount != null ? " — " + money(c.amount) : ""}{c.year ? " (" + c.year + ")" : ""}</div>
                  {c.purpose && <div className="text-muted-foreground mt-0.5">{c.purpose}</div>}
                  {c.citation && <a href={c.citation} target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1">Source <ExternalLink className="h-3 w-3" /></a>}
                </div>
              ))}
            </div>
          )}
          {(a.settlements || []).length > 0 && (
            <div>
              <div className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-1">Settlements</div>
              {a.settlements.map((s, i) => (
                <div key={i} className="rounded-md border p-2 mb-1">
                  <div className="font-medium text-foreground">{s.case || s.name || "Settlement"}{s.amount != null ? " — " + money(s.amount) : ""}{s.year ? " (" + s.year + ")" : ""}</div>
                  {(s.purpose || s.description) && <div className="text-muted-foreground mt-0.5">{s.purpose || s.description}</div>}
                  {s.citation && <a href={s.citation} target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1">Source <ExternalLink className="h-3 w-3" /></a>}
                </div>
              ))}
            </div>
          )}
          {(a.funding || []).length > 0 && (
            <div>
              <div className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-1">Funding</div>
              {a.funding.map((f, i) => (
                <div key={i} className="rounded-md border p-2 mb-1">
                  <div className="font-medium text-foreground">{f.program || f.source || "Funding"}{f.amount != null ? " — " + money(f.amount) : ""}{f.year ? " (" + f.year + ")" : ""}</div>
                  {f.citation && <a href={f.citation} target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1">Source <ExternalLink className="h-3 w-3" /></a>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </details>
  );
}

export default function Directory() {
  const [ready, setReady] = useState(!!extras.directory);
  const [failed, setFailed] = useState(false);
  const [sub, setSub] = useState("agencies");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(300);

  useEffect(() => {
    let on = true;
    loadExtras().then((ok) => { if (on) { setReady(!!extras.directory); setFailed(!ok && !extras.directory); } }).catch(() => on && setFailed(true));
    return () => { on = false; };
  }, []);
  useEffect(() => { setShown(300); }, [q, sub]);

  const dir = extras.directory;
  const agencies = useMemo(() => {
    if (!dir) return [];
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return dir.agencies;
    return dir.agencies.filter((a) => {
      const hay = (a.name + " " + a.type + " " + a.county).toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [dir, q]);

  const rich = useMemo(() => (dir ? dir.agencies.filter((a) =>
    (a.contracts || []).length + (a.funding || []).length + (a.settlements || []).length > 0) : []), [dir]);

  const contracts = useMemo(() => {
    if (!dir) return [];
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return dir.contracts;
    return dir.contracts.filter((c) => {
      const hay = (c.client + " " + c.vendor + " " + c.subject + " " + c.body).toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [dir, q]);

  if (failed) return <div className="p-6 text-sm text-muted-foreground">Directory data could not be loaded. Refresh the page to try again.</div>;
  if (!ready || !dir) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the agency directory…
      </div>
    );
  }

  const meta = extraMeta("directory") || {};
  const subTab = (id, label, count) => (
    <button key={id} onClick={() => setSub(id)}
      className={"px-3 py-1.5 rounded-md text-[13px] transition-colors " + (sub === id ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>
      {label}{count != null ? <span className="ml-1.5 text-[11px] opacity-70">{count}</span> : null}
    </button>
  );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="eyebrow"><Building2 className="h-3.5 w-3.5" /> Public institutions</div>
      <h1 className="text-2xl font-bold mt-3 mb-1">Agency &amp; Public-Records Directory</h1>
      <p className="text-sm text-muted-foreground">
        {dir.agencies.length.toLocaleString()} California state and local agencies
        {meta.agencies ? "" : ""}, public-records research on policing vendors, and municipal
        surveillance contracts pulled from city Legistar systems.
      </p>

      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 mt-4 w-fit max-w-full overflow-x-auto">
        {subTab("agencies", "All agencies", dir.agencies.length)}
        {subTab("records", "Public records", rich.length + dir.vendors.length)}
        {subTab("contracts", "Municipal contracts", dir.contracts.length)}
      </div>

      {sub !== "records" && (
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={sub === "agencies" ? "Search agencies by name, type, or county…" : "Search contracts by city, vendor, or subject…"}
            className="pl-9 h-11" />
        </div>
      )}

      {sub === "agencies" && (
        <div className="mt-4 rounded-xl border overflow-hidden">
          {agencies.slice(0, shown).map((a, i) => <AgencyRow key={a.id || i} a={a} />)}
          {agencies.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No agencies match “{q}”.</div>}
          {agencies.length > shown && (
            <button className="w-full p-2.5 text-xs text-muted-foreground hover:bg-muted/40 border-t" onClick={() => setShown(shown + 300)}>
              Show more ({(agencies.length - shown).toLocaleString()} remaining)
            </button>
          )}
        </div>
      )}

      {sub === "records" && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border bg-muted/20 p-4 text-sm flex items-start gap-3">
            <ShieldCheck className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
            <span className="text-muted-foreground">
              Research dossier on {rich.length} law-enforcement agencies with public-records findings —
              vendor contracts, settlements, and funding — plus the {dir.vendors.length} vendors behind them.
              Every entry links to its public source.
            </span>
          </div>
          {rich.map((a) => <div key={a.id} className="rounded-xl border"><AgencyRow a={a} /></div>)}
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground pt-2">Vendors</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {dir.vendors.map((v, i) => (
              <div key={v.id || i} className="rounded-xl border p-3.5">
                <div className="font-semibold text-sm">{v.name}</div>
                {(v.services || []).length > 0 && (
                  <ul className="mt-1.5 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                    {v.services.map((s, j) => <li key={j}>{s}</li>)}
                  </ul>
                )}
                {(v.agencies || []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.agencies.map((id) => {
                      const ag = dir.agencies.find((x) => x.id === id);
                      return <span key={id} className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{ag ? ag.name : id}</span>;
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {sub === "contracts" && (
        <div className="mt-4 rounded-xl border divide-y overflow-hidden">
          {contracts.map((c, i) => (
            <div key={i} className="p-3.5">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-semibold text-sm capitalize">{c.client}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{c.vendor}</span>
                <span className={"rounded-full border px-2 py-0.5 " + (c.status === "Passed" ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400" : "text-muted-foreground")}>{c.status}</span>
                <span className="ml-auto text-muted-foreground whitespace-nowrap">{c.date}{c.file ? " · " + c.file : ""}</span>
              </div>
              <div className="text-[13px] mt-1.5 line-clamp-3">{c.subject}</div>
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                {c.body && <span>{c.body}</span>}
                {c.url && (
                  <a href={c.url} target="_blank" rel="noopener" className="ml-auto inline-flex items-center gap-1 hover:text-foreground">
                    Legistar record <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
          {contracts.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No contracts match “{q}”.</div>}
        </div>
      )}

      <p className="mt-5 text-xs text-muted-foreground">
        Compiled from public records requests and open municipal data — a dated research snapshot; verify details with the agencies listed.
      </p>
    </div>
  );
}
