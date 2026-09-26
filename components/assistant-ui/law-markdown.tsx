"use client";

import type { FC, ComponentPropsWithoutRef } from "react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { useAui } from "@assistant-ui/react";
import remarkGfm from "remark-gfm";

const CITE_HREF = "law-cite:";
const FOLLOWUP_HREF = "law-followup:";
const AUTHORITY_HREF = "law-authority:";

/** [1] [s2] [b3] [r1] [c4] — citation markers from corpus tools + pre-retrieval */
const CITE_RE = /\[\s*([sbrcp]?\d{1,2})\s*\]/gi;

const FOLLOWUP_RE =
  /(?:^|\n)[ \t]*FOLLOWUPS:[ \t]*\n([\s\S]*?)(?=\n[ \t]*AUTHORITIES:|$)/i;

const AUTHORITIES_RE =
  /(?:^|\n)[ \t]*AUTHORITIES:[ \t]*\n([\s\S]*?)(?=\n[ \t]*FOLLOWUPS:|$)/i;

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

  if (typeof href === "string" && href.startsWith(`#${AUTHORITY_HREF}`)) {
    return <span className="law-authority-pill">{children}</span>;
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

  // Rewrite the AUTHORITIES block (emitted by the model) into pills.
  t = t.replace(AUTHORITIES_RE, (_m, block: string) => {
    const entries: Array<{ marker: string; label: string }> = [];
    for (const line of block.split("\n")) {
      const mm = line.trim().match(/^\[([^\]]+)\]\s*(.+)$/);
      if (mm) entries.push({ marker: mm[1].trim(), label: mm[2].trim() });
    }
    if (!entries.length) return "";
    return (
      "\n\nAuthorities:\n\n" +
      entries
        .map(
          (e) =>
            `[${e.marker} ${e.label}](#${AUTHORITY_HREF}${encodeURIComponent(e.marker)})`,
        )
        .join("\n\n") +
      "\n"
    );
  });

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
