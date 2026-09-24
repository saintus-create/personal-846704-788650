"use client";

import Bills from "@/app/_components/browsers/Bills";
import { BrowseShell } from "@/app/_components/browsers/browse-shell";

export default function BillsPage() {
  return (
    <BrowseShell active="/bills">
      <div className="h-full overflow-y-auto">
        <Bills />
      </div>
    </BrowseShell>
  );
}
