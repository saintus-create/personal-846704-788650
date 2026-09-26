import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wrap = (definition: any) =>
  tool({
    description: definition.description,
    inputSchema: definition.inputSchema,
    execute: definition.execute,
  });

const TOOLS = {
  search_statutes: wrap(searchStatutes),
  lookup_section: wrap(lookupSection),
  search_bills: wrap(searchBills),
  search_rules: wrap(searchRules),
  search_cases: wrap(searchCases),
};

export const maxDuration = 300;

type PreSource = { marker: string; citation: string };

/**
 * Server-side pre-retrieval: guarantees every answer is grounded in the corpus
 * even when the model skips its tools. Sources are labeled [1], [2], ...,
 * injected into the system prompt, AND streamed to the client as a data part
 * so the Authorities row can show them.
 */
async function preRetrieve(
  question: string,
): Promise<{ block: string; sources: PreSource[] }> {
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
  if (!records.length) return { block: "", sources: [] };
  const hits = scoreSections([question], records, undefined, 6);
  if (!hits.length) return { block: "", sources: [] };
  const sources: PreSource[] = hits.map((h, i) => ({
    marker: `[${i + 1}]`,
    citation: h.citation + (h.repealed ? " (REPEALED)" : ""),
  }));
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
  return { block, sources };
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

export async function POST(req: Request) {
  const { messages } = await req.json();

  let system = SYSTEM_PROMPT;
  let preSources: PreSource[] = [];
  const question = lastUserQuestion(messages);
  if (question.length > 8) {
    try {
      const { block, sources } = await preRetrieve(question);
      if (block) {
        system +=
          "\n\nStatute sources were pre-retrieved from the California Codes for this question, labeled [1], [2], etc. " +
          "Cite the ones you rely on with their exact bracketed markers like [1] or [2]. " +
          "You may still call tools to dig deeper or to check bills, rules, or case law.\n\n" +
          block;
        preSources = sources;
      }
    } catch (e) {
      console.error("[api/chat] pre-retrieval failed:", e);
    }
  }

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

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      if (preSources.length) {
        writer.write({ type: "data-law-sources", data: { sources: preSources } });
      }
      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}
