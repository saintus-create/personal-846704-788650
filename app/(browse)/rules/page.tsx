"use client";

import Rules from "@/app/_components/browsers/Rules";
import { BrowseShell } from "@/app/_components/browsers/browse-shell";

export default function RulesPage() {
  return (
    <BrowseShell active="/rules">
      <div className="h-full overflow-y-auto">
        <Rules jumpRule={null} />
      </div>
    </BrowseShell>
  );
}
