"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fmtQueries(queries: any): string {
  if (!Array.isArray(queries)) return "";
  return queries
    .slice(0, 2)
    .map((q) => `"${String(q).slice(0, 48)}"`)
    .join(", ");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describe(toolName: string, args: any): string {
  switch (toolName) {
    case "search_statutes":
      return `Searching the California Codes — ${fmtQueries(args?.queries)}`;
    case "lookup_section":
      return args?.abbr && args?.section
        ? `Reading ${String(args.abbr).toUpperCase()} § ${args.section}`
        : "Reading statute section";
    case "search_bills":
      return `Searching 2025\u201326 legislation — ${fmtQueries(args?.queries)}`;
    case "search_rules":
      return `Searching Rules of Court — ${fmtQueries(args?.queries)}`;
    case "search_cases":
      return `Searching case law — ${fmtQueries(args?.queries)}`;
    default:
      return toolName;
  }
}

/** Readable one-line step for each corpus tool call (replaces the raw JSON fallback). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LawToolCall: ToolCallMessagePartComponent = ({ toolName, args, result }) => {
  const running = result === undefined || result === null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sources = (result as any)?.sources;
  const found = Array.isArray(sources) ? sources.length : 0;

  return (
    <div className="law-tool-step" data-running={running ? "true" : "false"}>
      {running ? (
        <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" />
      ) : (
        <CheckIcon className="size-3.5 shrink-0 text-green-600 dark:text-green-400" />
      )}
      <span className="law-tool-step-label">{describe(toolName, args)}</span>
      {!running && found > 0 ? (
        <span className="law-tool-step-detail">{found} found</span>
      ) : null}
    </div>
  );
};
