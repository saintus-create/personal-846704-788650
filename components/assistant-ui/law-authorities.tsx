"use client";

import type { FC } from "react";
import { useAuiState } from "@assistant-ui/react";
import { useLawSources } from "@/components/assistant-ui/law-markdown";

/** "Authorities:" pill row shown under each assistant answer, like the old app. */
export const LawAuthorities: FC = () => {
  const sources = useLawSources();
  const isRunning = useAuiState(
    (s: { message?: { status?: { type?: string } } }) =>
      s?.message?.status?.type === "running",
  );

  if (!sources.length || isRunning) return null;

  return (
    <div className="law-authorities" data-slot="law-authorities">
      <span className="law-authorities-label">Authorities:</span>
      {sources.map((s) =>
        s.href ? (
          <a
            key={s.marker}
            href={s.href}
            target="_blank"
            rel="noreferrer"
            className="law-authority-pill"
            title={s.label}
          >
            #{s.marker} {s.label}
          </a>
        ) : (
          <span key={s.marker} className="law-authority-pill" title={s.label}>
            #{s.marker} {s.label}
          </span>
        ),
      )}
    </div>
  );
};
