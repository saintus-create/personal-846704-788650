"use client";

import { useEffect, useState } from "react";
import Browser from "@/app/_components/browsers/Browser";
import { BrowseShell } from "@/app/_components/browsers/browse-shell";
import { codes, loadCorpus } from "@/lib/engine";

export default function CodesPage() {
  const [ready, setReady] = useState(false);
  const [activeCode, setActiveCode] = useState<string | null>(null);

  useEffect(() => {
    loadCorpus(() => {}).then(() => setReady(true)).catch(() => setReady(true));
  }, []);

  return (
    <BrowseShell active="/codes">
      <div className="flex h-full">
        <div className="hidden w-64 shrink-0 border-r border-border md:block">
          <div className="h-full overflow-y-auto p-3">
            <div className="px-2 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              California Codes
            </div>
            {codes.map((c) => (
              <button
                className={
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors " +
                  (activeCode === c.abbr
                    ? "bg-muted font-medium text-foreground"
                    : "text-foreground hover:bg-muted/50")
                }
                key={c.abbr}
                onClick={() => setActiveCode(c.abbr)}
                type="button"
              >
                <span className="truncate">{c.name}</span>
                <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                  {c.sections.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto">
          <Browser
            activeCode={activeCode}
            jumpSection={null}
            onCodeChange={(a: string | null) => setActiveCode(a)}
          />
        </div>
      </div>
      {!ready ? null : null}
    </BrowseShell>
  );
}
