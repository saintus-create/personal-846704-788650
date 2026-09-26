import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Search published (precedential) California appellate and Supreme Court opinions via CourtListener. " +
    "Use for questions about how courts have interpreted a statute, or for case law generally. " +
    "Returns case sources like [c1], [c2] to cite inline.",
  inputSchema: z.object({
    queries: z.array(z.string().min(6)).min(1).max(3),
  }),
  async execute({ queries }) {
    const token = process.env.COURTLISTENER_TOKEN || "";
    const out: Array<Record<string, string>> = [];
    let tried = 0;
    for (const q of queries) {
      if (out.length >= 5 || tried >= 2) break;
      tried++;
      try {
        const url = "https://www.courtlistener.com/api/rest/v4/search/?q=" + encodeURIComponent(q) + "&court=cal+calctapp&type=o&stat_Precedential=on";
        const resp = await fetch(url, {
          headers: token ? { Authorization: "Token " + token } : {},
          signal: AbortSignal.timeout(9000),
        });
        if (!resp.ok) { if (resp.status === 429) break; continue; }
        const data = (await resp.json()) as { results?: Array<Record<string, unknown>> };
        for (const r of data.results || []) {
          if (out.length >= 5) break;
          const caseName = String(r.caseName || "Unknown case");
          if (out.some((x) => x.caseName === caseName)) continue;
          const cites = (r.citations as Array<{ cite?: string }>) || [];
          out.push({
            caseName,
            cite: cites[0]?.cite || "",
            court: String(r.court || ""),
            date: String(r.dateFiled || ""),
            snippet: String(r.snippet || "").replace(/<[^>]+>/g, "").slice(0, 700),
            url: r.absolute_url ? "https://www.courtlistener.com" + String(r.absolute_url) : "",
          });
        }
      } catch { break; }
    }
    if (!out.length) return { sources: [], note: "No opinions found (or CourtListener unavailable)." };
    return {
      note: "Cite like [c1]. These are precedential published opinions.",
      sources: out.map((c, i) => ({ marker: `[c${i + 1}]`, ...c })),
    };
  },
});
