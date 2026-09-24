"use client";

import { BookOpenIcon, Building2Icon, GavelIcon, LandmarkIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/codes", label: "Codes", icon: BookOpenIcon },
  { href: "/bills", label: "Bills", icon: LandmarkIcon },
  { href: "/rules", label: "Rules of Court", icon: GavelIcon },
  { href: "/directory", label: "Directory", icon: Building2Icon },
];

export function BrowseShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <Link className="hidden text-sm font-medium hover:text-muted-foreground sm:block" href="/">
          ← Chat
        </Link>
        <Link className="text-sm font-medium sm:hidden" href="/">
          ←
        </Link>
        <nav className="flex items-center gap-1" aria-label="Research library">
          {TABS.map((t) => (
            <Link
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-2.5 text-sm transition-colors",
                active === t.href
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
              href={t.href}
              key={t.href}
            >
              <t.icon className="size-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </Link>
          ))}
        </nav>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
