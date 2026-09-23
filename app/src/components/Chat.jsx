import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Scale, Loader2, ExternalLink, Copy, Check, Download, RefreshCw, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { miniMd, withCites, Html } from "@/components/mini-md";
import {
  loadCorpus, corpusReady, planQuestion, searchSections, analyzeSections, searchCaseLaw,
  llm, llmStream, suggestFollowUps, SYSTEM_PROMPT, store,
} from "@/lib/engine";

const EXAMPLES = [
  "What's the difference between burglary and robbery in California?",
  "What is the statute of limitations for personal injury in California?",
  "When can a landlord enter a tenant's unit, and what are the penalties for violating it?",
  "What are the exceptions to at-will employment in California?",
  "How does California define self-defense in criminal cases?",
  "What must a business do to comply with CCPA data-deletion requests?",
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
  const [status, setStatus] = useState(null);
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
  useEffect(() => { onBusyChange && onBusyChange(!!status); }, [status, onBusyChange]);

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
  }, [messages, status]);

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

      let used = [];
      const deepMode = deep && corpusReady && plan.type !== "lookup" && (plan.subquestions || []).length > 1;
      if (deepMode) {
        st("Deep research: retrieving for each sub-question…");
        const seen = {};
        const pushCand = (x) => { const k = x.abbr + "|" + (x.r.citation || x.r.section); if (!seen[k]) { seen[k] = 1; used.push(x); } };
        for (const sq of plan.subquestions.slice(0, 3)) {
          for (const x of searchSections([sq], plan.codes, 10).slice(0, 5)) pushCand(x);
        }
        for (const x of searchSections(plan.queries, plan.codes, 14)) pushCand(x);
        if (used.length > 16) {
          st("Deep research: analyzing the best sources…");
          used = await analyzeSections(q, used.slice(0, 30));
        }
      } else {
        st(plan.type === "lookup" ? "Locating the section…" : "Retrieving relevant sources…");
        const candidates = corpusReady ? searchSections(plan.queries, plan.codes, 24) : [];
        if (plan.type !== "lookup" && candidates.length > 10) {
          st(`Analyzing ${candidates.length} sections and searching judicial opinions…`);
          const both = await Promise.all([analyzeSections(q, candidates), searchCaseLaw(plan.queries)]);
          used = both[0];
        } else used = candidates;
      }
      const cases = corpusReady ? await searchCaseLaw(plan.queries) : [];

      st(`Reasoning across ${used.length ? used.length + " sources" : "sources"} and drafting the answer…`);
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
        "\n\nCite the sources you rely on inline using their exact bracketed markers, like [3] or [c2], placed right after the sentence each supports." +
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
      update(aiIdx, { role: "ai", content: answer, sources, prompt: prompt, question: q });
      persist();

      st("Thinking about what to ask next…");
      const fups = await suggestFollowUps(q, answer);
      update(aiIdx, { role: "ai", content: answer, sources, prompt: prompt, question: q, followUps: fups });
      setStatus(null);
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
      setStatus(null);
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pt-6" ref={scrollBox}>
        <div className="max-w-3xl mx-auto flex flex-col gap-5">
          {messages.length === 0 && (
            <div className="pt-6 sm:pt-12 pb-4">
              <div className="relative overflow-hidden rounded-3xl px-6 py-14 sm:py-20 text-center empty-hero">
                <div className="absolute inset-0 bg-grid" />
                <div className="relative">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl border bg-card mb-5">
                    <Scale className="h-5 w-5 brand-color" />
                  </div>
                  <h1 className="text-3xl sm:text-[2.75rem] font-semibold tracking-tight leading-tight">
                    California law, <span className="brand-color">answered.</span>
                  </h1>
                  <p className="text-muted-foreground text-[15px] mt-4 max-w-md mx-auto leading-7">
                    The complete California Codes (162,324 sections) plus retrieved judicial opinions,
                    reasoned through and cited. Ask anything, or start here:
                  </p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-6 text-left">
                {EXAMPLES.map((ex, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.06, duration: 0.35, ease: "easeOut" }}>
                    <Card className="p-4 cursor-pointer card-lift bg-transparent" onClick={() => askText(ex)}>
                      <div className="text-sm">{ex}</div>
                      <div className="text-xs text-muted-foreground mt-1">{
                        ["Criminal law", "Civil procedure", "Tenant rights", "Employment", "Criminal defense", "Privacy"][i]
                      }</div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              <div className="max-w-[92%] sm:max-w-[85%]">
                {m.role === "user" ? (
                  <div className="bg-muted rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] whitespace-pre-wrap">{m.content}</div>
                ) : (
                  <>
                    <Html content={withCites(miniMd(m.content || ""))} className={AI_MD_CLASSES + (m.error ? " text-destructive whitespace-pre-wrap" : "")} onCite={handleCite(m)} />
                    {m.streaming && <span className="inline-block w-2 h-4 bg-foreground/60 animate-pulse ml-0.5 align-middle rounded-sm" />}
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
          <AnimatePresence>
            {status && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {status}
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={logEnd} />
        </div>
      </div>
      <div className="p-4 pb-6 border-t bg-background">
        <form onSubmit={ask} className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about California law…"
              className="h-11 rounded-xl text-[15px]" />
            <Button type="submit" size="icon" className="h-11 w-11 rounded-xl shrink-0" disabled={!!status}><ArrowUp /></Button>
          </div>
          <div className="flex items-center gap-2 mt-2 justify-between">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <Switch checked={deep} onCheckedChange={toggleDeep} />
              <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" /> Deep research</span>
            </label>
            <span className="text-[11px] text-muted-foreground">Answers cite their sources - click any [marker] or authority chip.</span>
          </div>
        </form>
      </div>
    </div>
  );
}
