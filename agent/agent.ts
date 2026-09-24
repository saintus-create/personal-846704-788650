import { defineAgent } from "eve";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const KEY = process.env.SARVAM_API_KEY || "sk_2tvionrw_hfDAK3RK1XhF66Ix9NfM4kSQ";

const sarvam = createOpenAICompatible({
  name: "sarvam",
  baseURL: "https://api.sarvam.ai/v1",
  apiKey: KEY,
  headers: { "api-subscription-key": KEY },
});

export default defineAgent({
  model: sarvam("sarvam-105b-conversations"),
  modelContextWindowTokens: 65536,
});
