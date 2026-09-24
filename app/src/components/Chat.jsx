import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Scale, Loader2, ExternalLink, Copy, Check, Download, RefreshCw, Zap, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { miniMd, withCites, Html } from "@/components/mini-md";
import {
  loadCorpus, corpusReady, planQuestion, searchSections, analyzeSections, searchCaseLaw,
  llm, llmStream, suggestFollowUps, SYSTEM_PROMPT, store,
} from "@/lib/engine";

const EXAMPLES = [
  { q: "What's the difference between burglary and robbery in California?", label: "Burglary vs. robbery" },
  { q: "What is the statute of limitations for personal injury in California?", label: "PI statute of limitations" },
  { q: "When can a landlord enter a tenant's unit, and what are the penalties for violating it?", label: "Landlord entry rules" },
  { q: "What are the exceptions to at-will employment in California?", label: "At-will exceptions" },
  { q: "How does California define self-defense in criminal cases?", label: "Self-defense in CA" },
  { q: "What must a business do to comply with CCPA data-deletion requests?", label: "CCPA deletion rules" },
];

const AI_MD_CLASSES = "text-[15px] [&_p]:leading-7 [&_li]:leading-relaxed [&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:font-semibold " +
  "[&_ul]:my-2 [&_ol]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-1 " +
  "[&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 " +
  "[&_table]:w-full [&_table]:my-3 [&_table]:text-[13px] [&_th]:border-b [&_th]:border-border [&_th]:bg-transparent [&_th]:px-2 [&_th]:py-1 [&_th]:text-left " +
  "[&_td]:border-b [&_td]:border-border/60 [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top " +
  "[&_.cite-mark]:cursor-pointer [&_.cite-mark]:inline-flex [&_.cite-mark]:items-center [&_.cite-mark]:rounded " +
  "[&_.cite-mark]:bg-muted [&_.cite-mark]:px-1 [&_.cite-mark]:text-[10px] [&_.cite-mark]:font-semibold [&_.cite-mark]:leading-none " +
  "[&_.cite-mark]:align-baseline hover:[&_.cite-mark]:bg-accent";

export default function Chat({ activeChat, onUpdateChat, onNewChat, onJump, onCorpusStatus, onBusyChange }) {
  const [messages, setMessages] = useState(() => (activeChat ? activeChat.msgs : []));
  const [steps, setSteps] = useState([]);
  const [input, setInput] = useState("");
  const [deep, setDeep] = useState(() => localStorage.getItem("ai2.deep") === "1");
  const [copied, setCopied] = useState(null);
  const busy = useRef(false);
  const chatId = useRef(activeChat ? activeChat.id : null);
  const msgsRef = useRef(messages);
  const logEnd = useRef(null);
  const scrollBox = useRef(null);

  useEffect(() => { msgsRef.current = messages; }, [messages]);
  useEffect(() => { chatId.current = activeChat ? activeChat.id : null; }, [activeChat]);
  const working = steps.length > 0;
  useEffect(() => { onBusyChange && onBusyChange(working); }, [working, onBusyChange]);

  useEffect(() => {
    setMessages(activeChat ? activeChat.msgs : []);
    if (scrollBox.current) scrollBox.current.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat && activeChat.id]);

  useEffect(() => {
    const box = scrollBox.current;
    if (!box || !logEnd.current) return;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 160;
    if (nearBottom) logEnd.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, steps]);

  const persist = () => { if (chatId.current) onUpdateChat(chatId.current, msgsRef.current); };

  const push = (m) => setMessages((p) => { const n = [...p, m]; msgsRef.current = n; return n; });
  const update = (i, m) => setMessages((p) => {
    const n = p.map((x, j) => (j === i ? m : x)); msgsRef.current = n; return n;
  });

  async function askText(q) {
    if (busy.current) return;
    if (!chatId.current && onNewChat) { chatId.current = onNewChat(); }
    busy.current = true;
    setInput("");
    push({ role: "user", content: q });

    const stepSet = (label, detail, done) => setSteps((prev) => {
      const i = prev.findIndex((x) => x.label === label);
      const e = { label, detail: detail || "", done: !!done };
      if (i === -1) return [...prev, e];
      const c = [...prev]; c[i] = e; return c;
    });
    try {
      stepSet("Understanding the question", "", false);
      if (!corpusReady) {
        stepSet("Loading the California Codes", "first visit only", false);
        await loadCorpus((p) => onCorpusStatus && onCorpusStatus(p));
        onCorpusStatus && onCorpusStatus("ready");
        stepSet("Loading the California Codes", "done", true);
      }
      let plan = { type: "research", queries: [q], codes: [], subquestions: [] };
      if (corpusReady) plan = await planQuestion(q);
      stepSet("Understanding the question", (plan.type === "lookup" ? "section lookup" : plan.queries.length + " searches") +
        (plan.codes && plan.codes.length ? " · " + plan.codes.join(" ") : ""), true);

      let used = [];
      const deepMode = deep && corpusReady && plan.type !== "lookup" && (plan.subquestions || []).length > 1;
      if (deepMode) {
        stepSet("Retrieving statutes", "sub-question passes", false);
        const seen = {};
        const pushCand = (x) => { const k = x.abbr + "|" + (x.r.citation || x.r.section); if (!seen[k]) { seen[k] = 1; used.push(x); } };
        for (const sq of plan.subquestions.slice(0, 3)) {
          for (const x of searchSections([sq], plan.codes, 10).slice(0, 5)) pushCand(x);
        }
        for (const x of searchSections(plan.queries, plan.codes, 14)) pushCand(x);
        stepSet("Retrieving statutes", used.length + " sections found", true);
        if (used.length > 16) {
          stepSet("Analyzing sections", "shortlisting the most relevant", false);
          used = await analyzeSections(q, used.slice(0, 30));
          stepSet("Analyzing sections", used.length + " most relevant kept", true);
        }
      } else {
        stepSet("Retrieving statutes", "", false);
        const candidates = corpusReady ? searchSections(plan.queries, plan.codes, 24) : [];
        stepSet("Retrieving statutes", candidates.length + " candidate sections", true);
        if (plan.type !== "lookup" && candidates.length > 10) {
          stepSet("Analyzing sections", candidates.length + " candidates · verifying relevance", false);
          const both = await Promise.all([analyzeSections(q, candidates), searchCaseLaw(plan.queries)]);
          used = both[0];
          stepSet("Analyzing sections", used.length + " most relevant kept", true);
        } else used = candidates;
      }
      stepSet("Searching judicial opinions", "CourtListener · precedential", false);
      const cases = corpusReady ? await searchCaseLaw(plan.queries) : [];
      stepSet("Searching judicial opinions", cases.length + " opinions found", true);

      stepSet("Reasoning", (used.length + cases.length) + " sources", true);
      stepSet("Drafting the answer", "streaming", false);
      let context = used.length
        ? "Retrieved sections from the California Codes corpus (statute sources, labeled [1], [2], ...):\n\n" +
          used.map((x, i) => {
            const cite = x.r.citation || (x.abbr + " \u00A7 " + x.r.section);
            return "[" + (i + 1) + "] " + cite + (x.r.repealed ? " (REPEALED)" : "") + "\n" +
              String(x.r.text || "").slice(0, deepMode ? 2000 : 1600) +
              (x.r.history ? "\nLegislative history: " + String(x.r.history).slice(0, 220) : "");
          }).join("\n\n")
        : "Note: no California statutes were retrieved for this question.";
      if (cases.length) {
        context += "\n\nRetrieved judicial opinions (case sources, labeled [c1], [c2], ... - via CourtListener):\n\n" +
          cases.map((x, i) => "[c" + (i + 1) + "] " + x.caseName + " (" + x.cite + (x.date ? ", " + x.date : "") + ")\n" + x.snippet).join("\n\n");
      }
      let prompt = context +
        ((used.length || cases.length) ? "\n\nCite the sources you rely on inline using their exact bracketed markers, like [3] or [c2], placed right after the sentence each supports." : "") +
        "\n\nQuestion: " + q;
      if (plan.subquestions && plan.subquestions.length) prompt += "\n\nSub-questions to cover: " + plan.subquestions.join(" | ");

      const hist = [];
      for (const m of msgsRef.current) {
        if (m.role === "user") hist.push({ role: "user", content: m.prompt || m.content });
        else if (m.content) hist.push({ role: "assistant", content: m.content });
      }
      hist.push({ role: "user", content: prompt });
      const maxTok = deepMode ? 2400 : 1600;
      const msgs = [{ role: "system", content: SYSTEM_PROMPT }, ...hist.slice(-8)];

      const aiIdx = msgsRef.current.length;
      push({ role: "ai", content: "", streaming: true });
      let answer = "";
      try {
        answer = await llmStream(msgs, maxTok, (d) => {
          answer = answer + d;
          update(aiIdx, { role: "ai", content: answer, streaming: true });
        });
      } catch (e) {
        if (!answer) answer = await llm(msgs, maxTok);
      }

      const sources = used.map((x, i) => ({
        n: i + 1, label: x.r.citation || (x.abbr + " \u00A7 " + x.r.section), abbr: x.abbr, section: x.r.section,
      })).concat(cases.map((x, i) => ({ n: "c" + (i + 1), label: x.caseName + (x.cite ? " (" + x.cite + ")" : ""), url: x.url })));
      const markers = answer.match(/\[\s*(?:c)?\d+\s*\]/gi) || [];
      const matched = markers.filter((mk) => {
        const v = mk.replace(/[\[\]\s]/g, "").toLowerCase();
        return sources.some((x) => String(x.n).toLowerCase() === v);
      }).length;
      const verified = (used.length || cases.length) && markers.length
        ? markers.length + " citations \u00B7 " + matched + " matched to retrieved sources" : "";
      update(aiIdx, { role: "ai", content: answer, sources, prompt: prompt, question: q, verified });
      persist();

      stepSet("Drafting the answer", "done", true);
      const fups = await suggestFollowUps(q, answer);
      update(aiIdx, { role: "ai", content: answer, sources, prompt: prompt, question: q, verified, followUps: fups });
      setSteps([]);
      persist();
    } catch (err) {
      let m = String(err.message);
      if (m.startsWith("NOKEY:")) m = "This engine needs an API key - open settings (gear icon) to add one, or switch to Sarvam / free.";
      else if (store.provider !== "pollinations" && /Failed to fetch|NetworkError|CORS/i.test(m))
        m += "\n\nIf this persists, the Sarvam or free engines are the most reliable from a browser.";
      const lastQ = { role: "user", content: q };
      push({ role: "ai", content: m, error: true, retry: q });
      persist();
    } finally {
      busy.current = false;
      setSteps([]);
    }
  }

  const ask = (e) => { e.preventDefault(); const q = input.trim(); if (q) askText(q); };
  const toggleDeep = (v) => { setDeep(v); localStorage.setItem("ai2.deep", v ? "1" : "0"); };

  const copyMsg = async (m, i) => {
    try { await navigator.clipboard.writeText(m.content); setCopied(i); setTimeout(() => setCopied(null), 1500); } catch (e) {}
  };
  const downloadMsg = (m) => {
    const blob = new Blob([m.content], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (m.question || "answer").slice(0, 60).replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") + ".md";
    a.click(); URL.revokeObjectURL(a.href);
  };

  const handleCite = (m) => (cite) => {
    const s = (m.sources || []).find((x) => String(x.n) === String(cite));
    if (!s) return;
    if (s.url) window.open(s.url, "_blank");
    else onJump && onJump(s.abbr, s.section);
  };

  const inputBar = (
    <form onSubmit={ask} className="w-full">
      <div className="rounded-2xl border bg-card shadow-sm focus-within:ring-1 focus-within:ring-ring overflow-hidden">
        <Input value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about California law…"
          className="h-12 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 text-[15px] px-4" />
        <div className="flex items-center justify-between px-2.5 pb-2.5">
          <button type="button" onClick={() => toggleDeep(!deep)} title="Deep research"
            className={"inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors " +
              (deep ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
            <Zap className="h-4 w-4" />
          </button>
          <Button type="submit" size="icon" className="h-8 w-8 rounded-full" disabled={steps.length > 0}>
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  );

  if (messages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4 -mt-10">
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-3xl sm:text-4xl font-semibold tracking-tight text-center">
          California law, <span className="brand-color">answered.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}
          className="text-muted-foreground text-sm mt-3 mb-8 text-center">
          162,324 sections across 30 codes - statutes, precedential case law, legislative history
        </motion.p>
        <div className="w-full max-w-2xl">{inputBar}</div>
        <div className="flex flex-wrap justify-center gap-2 mt-6 max-w-2xl">
          {EXAMPLES.slice(0, 4).map((ex, i) => (
            <motion.button key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }} onClick={() => askText(ex.q)}
              className="text-[13px] px-3.5 py-1.5 rounded-full border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              {ex.label}
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pt-6" ref={scrollBox}>
        <div className="max-w-3xl mx-auto flex flex-col gap-5">
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              <div className="max-w-[92%] sm:max-w-[85%]">
                {m.role === "user" ? (
                  <div className="bg-muted rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] whitespace-pre-wrap">{m.content}</div>
                ) : (
                  <>
                    {m.verified && (
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1.5">
                        <ShieldCheck className="h-3 w-3 text-green-600 dark:text-green-400" />{m.verified}
                      </div>
                    )}
                    <Html content={withCites(miniMd(m.content || ""))} className={AI_MD_CLASSES + (m.error ? " text-destructive whitespace-pre-wrap" : "")} onCite={handleCite(m)} />
                    {m.streaming && (!m.content || m.content.replace(/\s/g, "").length < 40) && (
                      <div className="space-y-2.5 py-1.5 w-96 max-w-full">
                        <div className="shimmer-line w-11/12" />
                        <div className="shimmer-line w-full" />
                        <div className="shimmer-line w-4/5" />
                      </div>
                    )}
                    {m.streaming && m.content && m.content.replace(/\s/g, "").length >= 40 && <span className="inline-block w-2 h-4 bg-foreground/60 animate-pulse ml-0.5 align-middle rounded-sm" />}
                  </>
                )}
                {m.role === "ai" && !m.streaming && !m.error && (
                  <div className="flex gap-1 mt-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyMsg(m, i)} title="Copy">
                      {copied === i ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadMsg(m)} title="Download as markdown"><Download className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
                {m.role === "ai" && m.error && (
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => askText(m.retry)}>
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </Button>
                )}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1 self-center">Authorities:</span>
                    {m.sources.map((s, j) => s.url ? (
                      <a key={j} href={s.url} target="_blank" rel="noopener">
                        <Badge variant="secondary" className="cursor-pointer hover:bg-accent font-normal max-w-[280px] truncate">
                          {s.label} <ExternalLink className="h-3 w-3 ml-0.5 shrink-0" />
                        </Badge>
                      </a>
                    ) : (
                      <Badge key={j} variant="secondary" className="cursor-pointer hover:bg-accent font-normal max-w-[280px] truncate"
                        onClick={() => onJump && onJump(s.abbr, s.section)}>{"#" + s.n + "  " + s.label}</Badge>
                    ))}
                  </div>
                )}
                {m.followUps && m.followUps.length > 0 && !m.streaming && (
                  <div className="mt-3 flex flex-col gap-1.5 items-start">
                    <span className="text-xs text-muted-foreground">Keep digging:</span>
                    {m.followUps.map((f, j) => (
                      <button key={j} onClick={() => askText(f)}
                        className="text-left text-[13px] px-3 py-1.5 rounded-full border hover:bg-accent transition-colors">
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {steps.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-1.5 py-1">
              {steps.map((st, i) => (
                <div key={i} className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  {st.done ? <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                           : <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
                  {st.done
                    ? <span>{st.label}{st.detail ? <span className="opacity-70"> — {st.detail}</span> : null}</span>
                    : <span className="text-shimmer">{st.label}{st.detail ? " — " + st.detail : ""}</span>}
                </div>
              ))}
            </motion.div>
          )}
          <div ref={logEnd} />
        </div>
      </div>
      <div className="p-4 pb-6 border-t bg-background">
        <div className="max-w-3xl mx-auto">{inputBar}</div>
      </div>
    </div>
  );
}
