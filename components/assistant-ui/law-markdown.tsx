"use client";

import type { FC, ComponentPropsWithoutRef } from "react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { useAui, useAuiState } from "@assistant-ui/react";
import { useShallow } from "zustand/shallow";
import remarkGfm from "remark-gfm";

const CITE_HREF = "law-cite:";
const FOLLOWUP_HREF = "law-followup:";

/** [1] [s2] [b3] [r1] [c4] — citation markers from corpus tools + pre-retrieval */
const CITE_RE = /\[\s*([sbrcp]?\d{1,2})\s*\]/gi;

const FOLLOWUP_RE = /(?:^|\n)[ \t]*FOLLOWUPS:[ \t]*\n([\s\S]*)$/i;

type Aui = ReturnType<typeof useAui>;

function sendPromptFactory(aui: Aui) {
  return (prompt: string) => {
    if (aui.thread().getState().isRunning) return;
    aui.thread().append({
      content: [{ type: "text", text: prompt }],
      runConfig: aui.composer().getState().runConfig,
    });
  };
}

const LawLink: FC<ComponentPropsWithoutRef<"a">> = ({ href, children, ...props }) => {
  const aui = useAui();
  const sendPrompt = sendPromptFactory(aui);

  if (typeof href === "string" && href.startsWith(`#${CITE_HREF}`)) {
    const marker = decodeURIComponent(href.slice(CITE_HREF.length + 1));
    return (
      <a
        {...props}
        href={`#cite-${marker}`}
        className="law-cite-chip"
        title={`Authority ${marker}`}
        onClick={(e) => e.preventDefault()}
      >
        {marker}
      </a>
    );
  }

  if (typeof href === "string" && href.startsWith(`#${FOLLOWUP_HREF}`)) {
    const question = decodeURIComponent(href.slice(FOLLOWUP_HREF.length + 1));
    return (
      <button
        type="button"
        className="law-followup-pill"
        onClick={() => sendPrompt(question)}
      >
        {question}
      </button>
    );
  }

  return (
    <a {...props} href={href} target="_blank" rel="noreferrer" className="law-md-link">
      {children}
    </a>
  );
};

const preprocess = (text: string): string => {
  let t = text;

  // Rewrite the trailing FOLLOWUPS block into Keep digging pills.
  t = t.replace(FOLLOWUP_RE, (_m, block: string) => {
    const qs = block
      .split("\n")
      .map((l) => l.trim().replace(/^[-*\d.)\s]+/, "").trim())
      .filter((l) => l.length > 3)
      .slice(0, 3);
    if (!qs.length) return "";
    return (
      "\n\nKeep digging:\n\n" +
      qs.map((q) => `[${q}](#${FOLLOWUP_HREF}${encodeURIComponent(q)})`).join("\n\n") +
      "\n"
    );
  });

  // Rewrite citation markers into links so they render as chips.
  t = t.replace(CITE_RE, (_m, marker: string) =>
    `[${marker}](#${CITE_HREF}${encodeURIComponent(marker)})`,
  );

  return t;
};

export function LawMarkdownText() {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      className="aui-md"
      preprocess={preprocess}
      components={{ a: LawLink }}
    />
  );
}

export type LawSource = {
  marker: string;
  label: string;
  href?: string;
};

/** Read the current message's parts (text, tool results, data parts). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useMessageParts(): any[] {
  return useAuiState(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useShallow((s: any) => s?.message?.parts ?? s?.message?.content ?? []),
  );
}

function sourceFromEntry(s: Record<string, unknown>): LawSource | null {
  if (!s || typeof s.marker !== "string") return null;
  const key = s.marker.replace(/[[\]\s]/g, "");
  let label = "";
  if (typeof s.citation === "string" && s.citation) label = s.citation;
  else if (typeof s.rule === "string" && s.rule) label = s.rule;
  else if (typeof s.measure === "string" && s.measure)
    label = s.measure + (s.status ? ` \u00b7 ${s.status}` : "");
  else if (typeof s.caseName === "string" && s.caseName)
    label = s.caseName + (s.cite ? ` (${s.cite})` : "");
  if (!label) return null;
  return {
    marker: key,
    label,
    href:
      typeof s.official_text === "string" && s.official_text
        ? s.official_text
        : typeof s.url === "string" && s.url
          ? s.url
          : undefined,
  };
}

/** The authorities this message cites, resolved from tool results + data parts. */
export function useLawSources(): LawSource[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts = useMessageParts() as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const text: string = (parts ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) =>
      p && (p.type === "text" || p.type === "Text") && typeof p.text === "string"
        ? p.text
        : "",
    )
    .join("");
  const cited = new Set<string>();
  const re = new RegExp(CITE_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) cited.add(m[1]);
  if (!cited.size) return [];

  const out: LawSource[] = [];
  for (const p of parts ?? []) {
    if (!p) continue;
    // tool results (search_statutes, lookup_section, bills, rules, cases)
    const result = p.result ?? p.output;
    if (Array.isArray(result?.sources)) {
      for (const s of result.sources) {
        const src = sourceFromEntry(s);
        if (src && cited.has(src.marker)) out.push(src);
      }
    }
    // pre-retrieved sources streamed as a data part
    if (String(p.type ?? "").startsWith("data-law-sources") && Array.isArray(p.data?.sources)) {
      for (const s of p.data.sources) {
        const src = sourceFromEntry(s);
        if (src && cited.has(src.marker)) out.push(src);
      }
    }
  }

  const seen = new Set<string>();
  return out.filter((s) => (seen.has(s.marker) ? false : (seen.add(s.marker), true)));
}
