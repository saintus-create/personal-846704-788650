import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { SYSTEM_PROMPT } from "@/constants/system-prompt";
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

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: sarvam("sarvam-105b-conversations"),
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    stopWhen: stepCountIs(10),
    onError: (error) => {
      console.error("[api/chat]", error);
    },
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
