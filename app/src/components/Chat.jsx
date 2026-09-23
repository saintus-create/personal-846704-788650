import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Scale, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { miniMd, Html } from "@/components/mini-md";
import {
  loadCorpus, corpusReady, planQuestion, searchSections, analyzeSections, searchCaseLaw,
  llm, SYSTEM_PROMPT, store,
} from "@/lib/engine";

export default function Chat({ onJump, onCorpusStatus }) {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState(null);
  const [input, setInput] = useState("");
  const busy = useRef(false);
  const logRef = useRef(null);
  const historyRef = useRef([]);

  const push = (m) => setMessages((prev) => [...prev, m]);
  const update = (i, m) => setMessages((prev) => prev.map((x, j) => (j === i ? m : x)));

  useEffect(() => {
    if (messages.length === 0) {
      push({
        role: "ai",
        content: "Ask me anything - California law or otherwise. Statute and case-law questions get grounded in the complete " +
          "California Codes (162,324 sections) plus retrieved judicial opinions, with clickable citations; everything else I answer from knowledge.",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages, status]);

  async function ask(e) {
    e && e.preventDefault();
    const q = input.trim();
    if (!q || busy.current) return;
    busy.current = true;
    setInput("");
    push({ role: "user", content: q });

    const st = (t) => setStatus(t);
    try {
      st("Understanding the research question…");
      if (!corpusReady) {
        st("Loading the codes (first time only)…");
        await loadCorpus((p) => onCorpusStatus && onCorpusStatus(p));
        onCorpusStatus && onCorpusStatus("ready");
      }
      let plan = { type: "research", queries: [q], codes: [], subquestions: [] };
      if (corpusReady) plan = await planQuestion(q);

      st(plan.type === "lookup" ? "Locating the section…" : "Retrieving relevant sources…");
      let candidates = corpusReady ? searchSections(plan.queries, plan.codes, 24) : [];
      let used = candidates;
      let cases = [];
      if (plan.type !== "lookup" && candidates.length > 10) {
        st(`Analyzing ${candidates.length} sections and searching judicial opinions…`);
        const both = await Promise.all([analyzeSections(q, candidates), searchCaseLaw(plan.queries)]);
        used = both[0]; cases = both[1];
      } else if (corpusReady) {
        cases = await searchCaseLaw(plan.queries);
      }

      st(`Reasoning across ${used.length ? used.length + " sources" : "sources"} and drafting the answer…`);
      let context = used.length
        ? "Retrieved sections from the California Codes corpus:\n\n" + used.map((x, i) => {
            const cite = x.r.citation || (x.abbr + " § " + x.r.section);
            return "[" + (i + 1) + "] " + cite + (x.r.repealed ? " (REPEALED)" : "") + "\n" +
              String(x.r.text || "").slice(0, 1600) +
              (x.r.history ? "\nLegislative history: " + String(x.r.history).slice(0, 220) : "");
          }).join("\n\n")
        : "Note: no California statutes were retrieved for this question.";
      if (cases.length) {
        context += "\n\nRetrieved California judicial opinions (precedential, via CourtListener):\n\n" +
          cases.map((x, i) => "Case " + (i + 1) + ": " + x.caseName + "(" + x.cite + (x.date ? ", " + x.date : "") + ")\n" + x.snippet).join("\n\n");
      }
      let prompt = context + "\n\nQuestion: " + q;
      if (plan.subquestions && plan.subquestions.length) prompt += "\n\nSub-questions to cover: " + plan.subquestions.join(" | ");
      historyRef.current.push({ role: "user", content: prompt });
      const answer = await llm(
        [{ role: "system", content: SYSTEM_PROMPT }, ...historyRef.current.slice(-6)], 1600);
      historyRef.current.push({ role: "assistant", content: answer });

      const chips = used.map((x) => ({
        label: x.r.citation || (x.abbr + " § " + x.r.section),
        abbr: x.abbr, section: x.r.section,
      }));
      for (const c of cases) chips.push({ label: c.caseName + (c.cite ? " (" + c.cite + ")" : ""), url: c.url });

      setStatus(null);
      push({ role: "ai", content: answer, sources: chips });
    } catch (err) {
      setStatus(null);
      let m = String(err.message);
      if (m.startsWith("NOKEY:")) m = "This engine needs an API key - open settings (gear icon) to add one, or switch to Sarvam / free.";
      else if (store.provider !== "pollinations" && /Failed to fetch|NetworkError|CORS/i.test(m))
        m += "\n\nIf this persists, the Sarvam or free engines are the most reliable from a browser.";
      push({ role: "ai", content: m, error: true });
    } finally {
      busy.current = false;
      setStatus(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pt-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-5" ref={logRef}>
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "ai" && (
                <Avatar className="h-8 w-8 mt-1 border">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs"><Scale className="h-4 w-4" /></AvatarFallback>
                </Avatar>
              )}
              <Card className={`max-w-[92%] sm:max-w-[85%] px-4 py-3 ${m.role === "user" ? "bg-primary text-primary-foreground border-transparent" : ""}`}>
                <Html
                  content={m.role === "user" ? m.content : miniMd(m.content)}
                  className={m.role === "user" ? "text-sm whitespace-pre-wrap" :
                    "text-sm leading-relaxed [&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:font-semibold [&_ul]:my-2 [&_ol]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-1 [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 " +
                    (m.error ? "text-destructive" : "")}
                />
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-dashed flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1 self-center">Sources:</span>
                    {m.sources.map((s, j) => s.url ? (
                      <a key={j} href={s.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1">
                        <Badge variant="secondary" className="cursor-pointer hover:bg-accent font-normal">
                          {s.label} <ExternalLink className="h-3 w-3" />
                        </Badge>
                      </a>
                    ) : (
                      <Badge key={j} variant="secondary" className="cursor-pointer hover:bg-accent font-normal"
                        onClick={() => onJump && onJump(s.abbr, s.section)}>{s.label}</Badge>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ))}
          {status && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm pl-11">
              <Loader2 className="h-4 w-4 animate-spin" />
              {status}
            </div>
          )}
        </div>
      </div>
      <div className="p-4 pb-6">
        <form onSubmit={ask} className="max-w-3xl mx-auto flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about California law - or anything else…"
            className="h-11 rounded-xl text-[15px]" />
          <Button type="submit" size="icon" className="h-11 w-11 rounded-xl shrink-0"><ArrowUp /></Button>
        </form>
      </div>
    </div>
  );
}
