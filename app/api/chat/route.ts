import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { SYSTEM_PROMPT } from "@/constants/system-prompt";
import { CODE_NAMES, loadCode } from "@/agent/lib/corpus";
import { scoreSections } from "@/agent/lib/search";
import searchStatutes from "@/agent/tools/search_statutes";
import lookupSection from "@/agent/tools/lookup_section";
import searchBills from "@/agent/tools/search_bills";
import searchRules from "@/agent/tools/search_rules";
import searchCases from "@/agent/tools/search_cases";

const KEY = process.env.SARVAM_API_KEY || "sk_2tvionrw_hfDAK3RK1XhF66Ix9NfM4kSQ";

const sarvam = createOpenAICompatible({
  name: "sarvam",
  baseURL: "https://api.sarvam.ai/v1",
  apiKey: KEY,
  headers: { "api-subscription-key": KEY },
});

/** marker (no brackets, lowercase) -> human citation label */
type SourceMap = Map<string, string>;

/** minimal structural type for UI message stream parts */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StreamPart = { type: string; [k: string]: any };

function recordSources(out: unknown, map: SourceMap) {
  const sources = (out as { sources?: unknown })?.sources;
  if (!Array.isArray(sources)) return;
  for (const s of sources) {
    if (!s || typeof s.marker !== "string") continue;
    const key = s.marker.replace(/[[\]\s]/g, "").toLowerCase();
    if (!key || map.has(key)) continue;
    let label = "";
    if (typeof s.citation === "string" && s.citation) {
      label = s.citation + (s.repealed ? " (REPEALED)" : "");
    } else if (typeof s.rule === "string" && s.rule) label = s.rule;
    else if (typeof s.measure === "string" && s.measure)
      label = s.measure + (s.status ? ` \u00b7 ${s.status}` : "");
    else if (typeof s.caseName === "string" && s.caseName)
      label = s.caseName + (s.cite ? ` (${s.cite})` : "");
    if (label) map.set(key, label);
  }
}

/**
 * Wrap a corpus tool so its results also feed the server-side marker->citation
 * map used to build the deterministic Authorities block.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wrap = (definition: any, map: SourceMap) =>
  tool({
    description: definition.description,
    inputSchema: definition.inputSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (input: any, options: any) => {
      const out = await definition.execute(input, options);
      recordSources(out, map);
      return out;
    },
  });

export const maxDuration = 300;

/**
 * Server-side pre-retrieval: guarantees every answer is grounded in the corpus
 * even when the model skips its tools.
 */
async function preRetrieve(
  question: string,
): Promise<{ block: string; map: SourceMap }> {
  const abbrs = Object.keys(CODE_NAMES);
  const records: Array<{ abbr: string; r: Record<string, unknown> }> = [];
  await Promise.all(
    abbrs.map(async (a) => {
      const loaded = await loadCode(a).catch(() => []);
      for (const r of loaded) {
        records.push({ abbr: a, r: r as unknown as Record<string, unknown> });
      }
    }),
  );
  if (!records.length) return { block: "", map: new Map() };
  const hits = scoreSections([question], records, undefined, 6);
  if (!hits.length) return { block: "", map: new Map() };
  const map: SourceMap = new Map();
  hits.forEach((h, i) => map.set(String(i + 1), h.citation + (h.repealed ? " (REPEALED)" : "")));
  const block = hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.citation}${h.repealed ? " (REPEALED)" : ""}\n` +
        String(h.text || "").slice(0, 1200) +
        (h.history
          ? `\nLegislative history: ${String(h.history).slice(0, 200)}`
          : ""),
    )
    .join("\n\n");
  return { block, map };
}

type UITextPart = { type: "text"; text: string };

function lastUserQuestion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[],
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "user") continue;
    return (m.parts ?? [])
      .filter((p: UITextPart) => p?.type === "text")
      .map((p: UITextPart) => p.text)
      .join(" ")
      .trim();
  }
  return "";
}

const CITED_RE = /\[\s*([sbrcp]?\d{1,2})\s*\]/gi;
const AUTHORITIES_MARKER = "AUTHORITIES:";

export async function POST(req: Request) {
  const { messages } = await req.json();

  let system = SYSTEM_PROMPT;
  const sourceMap: SourceMap = new Map();
  const question = lastUserQuestion(messages);
  if (question.length > 8) {
    try {
      const { block, map } = await preRetrieve(question);
      if (block) {
        system +=
          "\n\nStatute sources were pre-retrieved from the California Codes for this question, labeled [1], [2], etc. " +
          "Cite the ones you rely on with their exact bracketed markers like [1] or [2]. " +
          "You may still call tools to dig deeper or to check bills, rules, or case law.\n\n" +
          block;
        for (const [k, v] of map) sourceMap.set(k, v);
      }
    } catch (e) {
      console.error("[api/chat] pre-retrieval failed:", e);
    }
  }

  const TOOLS = {
    search_statutes: wrap(searchStatutes, sourceMap),
    lookup_section: wrap(lookupSection, sourceMap),
    search_bills: wrap(searchBills, sourceMap),
    search_rules: wrap(searchRules, sourceMap),
    search_cases: wrap(searchCases, sourceMap),
  };

  const result = streamText({
    model: sarvam("sarvam-105b-conversations"),
    system,
    tools: TOOLS,
    stopWhen: stepCountIs(10),
    onError: (error) => {
      console.error("[api/chat]", error);
    },
    messages: await convertToModelMessages(messages),
  });

  /**
   * Stream transform: forward the model's text as it streams, but hold back a
   * small tail so a partially-streamed "AUTHORITIES:" marker never leaks.
   * When the stream finishes, append a deterministic AUTHORITIES block built
   * from the server-side source map (real tool + pre-retrieval citations),
   * then re-emit the model's FOLLOWUPS block if it got suppressed.
   */
  let acc = "";
  let forwarded = 0;
  let suppressedAt = -1;

  const tailGuard = AUTHORITIES_MARKER.length - 1;

  const appendBlock = (
    controller: TransformStreamDefaultController<StreamPart>,
    text: string,
  ) => {
    if (!text) return;
    const id = "law-" + Math.random().toString(36).slice(2, 10);
    controller.enqueue({ type: "text-start", id });
    controller.enqueue({ type: "text-delta", id, delta: text });
    controller.enqueue({ type: "text-end", id });
  };

  const sourceStream = (
    result.toUIMessageStream() as unknown as ReadableStream<StreamPart>
  ).pipeThrough(
    new TransformStream<StreamPart, StreamPart>({
      transform(part, controller) {
        if (part.type === "text-delta" && suppressedAt < 0) {
          acc += part.delta;
          const idx = acc.indexOf(AUTHORITIES_MARKER);
          if (idx >= 0) {
            suppressedAt = idx;
          } else {
            // forward everything except a tail that might become the marker
            const safe = Math.max(forwarded, acc.length - tailGuard);
            if (safe > forwarded) {
              controller.enqueue({
                type: "text-delta",
                id: part.id,
                delta: acc.slice(forwarded, safe),
              });
              forwarded = safe;
            }
          }
          return;
        }
        if (part.type === "text-delta") return; // after suppression: drop
        if (part.type === "text-end" && suppressedAt < 0) {
          // flush the guarded tail of the final text part
          if (acc.length > forwarded) {
            controller.enqueue({
              type: "text-delta",
              id: part.id,
              delta: acc.slice(forwarded),
            });
            forwarded = acc.length;
          }
          controller.enqueue(part);
          return;
        }
        if (part.type === "finish") {
          // deterministic AUTHORITIES from the real sources
          const citedText = suppressedAt >= 0 ? acc.slice(0, suppressedAt) : acc;
          const cited: string[] = [];
          const seen = new Set<string>();
          let m: RegExpExecArray | null;
          const re = new RegExp(CITED_RE.source, "gi");
          while ((m = re.exec(citedText))) {
            const key = m[1].toLowerCase();
            if (!seen.has(key) && sourceMap.has(key)) {
              seen.add(key);
              cited.push(key);
            }
          }
          if (cited.length) {
            const block =
              "\n\nAUTHORITIES:\n" +
              cited.map((k) => `[${k}] ${sourceMap.get(k)}`).join("\n") +
              "\n";
            appendBlock(controller, block);
          }
          // re-emit a suppressed FOLLOWUPS block if the model wrote one
          if (suppressedAt >= 0) {
            const fm = acc.slice(suppressedAt).match(
              /\n[ \t]*FOLLOWUPS:[ \t]*\n([\s\S]*)$/i,
            );
            if (fm && fm[1].trim()) {
              appendBlock(
                controller,
                "\nFOLLOWUPS:\n" + fm[1].replace(/\s+$/, "") + "\n",
              );
            }
          }
          controller.enqueue(part);
          return;
        }
        controller.enqueue(part);
      },
    }),
  );

  return new Response(sourceStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
