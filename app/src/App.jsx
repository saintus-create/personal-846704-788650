import React, { useEffect, useState, useCallback } from "react";
import { Scale, Sun, Moon, Plus, MessageSquare, Trash2, BookOpen, Bot, PanelLeft, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import Chat from "@/components/Chat";
import Browser from "@/components/Browser";
import { codes, loadCorpus, PROVIDERS, store, getModel } from "@/lib/engine";

const CHATS_KEY = "ai2.chats";

function loadChats() {
  try {
    const d = JSON.parse(localStorage.getItem(CHATS_KEY) || "{}");
    if (Array.isArray(d.chats)) return { chats: d.chats.slice(0, 30), activeId: d.activeId || null };
  } catch (e) {}
  return { chats: [], activeId: null };
}

export default function App() {
  const [tab, setTab] = useState("ai");
  const [engine, setEngine] = useState(store.provider);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [activeCode, setActiveCode] = useState(null);
  const [jumpSection, setJumpSection] = useState(null);
  const [corpusStatus, setCorpusStatus] = useState("Loading the California Codes…");
  const [{ chats, activeId }, setChatState] = useState(loadChats);
  const [busy, setBusy] = useState(false);
  const [sideOpen, setSideOpen] = useState(() => localStorage.getItem("ai2.side") === "1");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    loadCorpus(setCorpusStatus).then((ok) => setCorpusStatus(ok ? "ready" : "error")).catch(() => setCorpusStatus("error"));
  }, []);

  useEffect(() => { try { localStorage.setItem("ai2.side", sideOpen ? "1" : "0"); } catch (e) {} }, [sideOpen]);

  useEffect(() => {
    try { localStorage.setItem(CHATS_KEY, JSON.stringify({ chats: chats.slice(0, 30), activeId })); } catch (e) {}
  }, [chats, activeId]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const newChat = useCallback(() => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setChatState((s) => ({ chats: [{ id, title: "New chat", ts: Date.now(), msgs: [] }, ...s.chats].slice(0, 30), activeId: id }));
    return id;
  }, []);

  const selectChat = (id) => { setChatState((s) => ({ ...s, activeId: id })); setTab("ai"); };
  const deleteChat = (e, id) => {
    e.stopPropagation();
    setChatState((s) => ({ chats: s.chats.filter((c) => c.id !== id), activeId: s.activeId === id ? null : s.activeId }));
  };
  const updateChat = useCallback((id, msgs) => {
    setChatState((s) => ({
      ...s,
      chats: s.chats.map((c) => c.id !== id ? c : {
        ...c, msgs,
        title: (msgs.find((m) => m.role === "user") || {}).content?.slice(0, 48) || c.title,
      }),
    }));
  }, []);

  const jump = (abbr, section) => {
    setActiveCode(abbr);
    setJumpSection(section);
    setTab("codes");
  };

  const [sProvider, setSProvider] = useState(engine);
  const [sModel, setSModel] = useState(getModel());
  const [sKey, setSKey] = useState("");
  const [sCl, setSCl] = useState("");

  const openSettings = () => {
    setSProvider(store.provider);
    setSModel(store.model(store.provider));
    setSKey(store.key(store.provider));
    setSCl(store.clToken);
    setSettingsOpen(true);
  };
  const saveSettings = () => {
    store.provider = sProvider;
    store.setModel(sProvider, sModel);
    store.setKey(sProvider, sKey);
    store.clToken = sCl;
    setEngine(sProvider);
    setSettingsOpen(false);
  };

  const activeChat = chats.find((c) => c.id === activeId) || null;
  const iconTab = (active) =>
    "inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors " +
    (active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground");

  return (
    <div className="h-screen p-1.5 sm:p-2.5 bg-background">
      <div className="h-full rounded-xl border shadow-sm overflow-hidden flex flex-col bg-background">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 z-40">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 h-14">
            <div className="flex items-center gap-2 font-bold cursor-pointer select-none shrink-0" onClick={() => setTab("ai")}>
              <Scale className="h-5 w-5 brand-color" />
              <span className="hidden sm:inline">CA <span className="brand-color">Leg Info</span></span>
            </div>
            {tab === "ai" && (
              <Button variant="ghost" size="icon" className="h-8 w-8 hidden lg:inline-flex" onClick={() => setSideOpen(!sideOpen)} title="History">
                {sideOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
              </Button>
            )}
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1 ml-1">
              <button className={iconTab(tab === "ai")} onClick={() => setTab("ai")} title="Ask AI"><MessageSquare className="h-4 w-4" /></button>
              <button className={iconTab(tab === "codes")} onClick={() => setTab("codes")} title="Browse Codes"><BookOpen className="h-4 w-4" /></button>
            </div>
            <div className="flex-1" />
            {tab === "ai" && (
              <div className="hidden sm:block">
                <Badge variant="outline" className="font-normal text-muted-foreground max-w-[240px] truncate">
                  {corpusStatus === "ready" ? "\u2713 162,324 sections loaded" :
                   corpusStatus === "error" ? "corpus unavailable" : corpusStatus}
                </Badge>
              </div>
            )}
            {tab === "ai" && (
              <Button variant="outline" size="icon" onClick={() => { newChat(); }} title="New chat" className="h-8 w-8">
                <Plus className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openSettings} title={"AI engine: " + PROVIDERS[engine].label}>
              <Bot className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme} title="Theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {tab === "ai" ? (
            <div className="flex h-full">
              <div className={sideOpen ? "hidden lg:flex flex-col w-60 border-r shrink-0" : "hidden"}>
                <div className="p-3">
                  <Button onClick={() => { newChat(); }} variant="outline" size="sm" className="w-full justify-start gap-2 h-8" disabled={busy}>
                    <Plus className="h-4 w-4" /> New chat
                  </Button>
                </div>
                <ScrollArea className="flex-1 px-3 pb-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-2 pt-3 pb-2">History</div>
                  <div className="flex flex-col gap-0.5">
                    {chats.length === 0 && (
                      <div className="text-xs text-muted-foreground px-2 py-4">No conversations yet. Your chats are saved in this browser.</div>
                    )}
                    {chats.map((c) => (
                      <button key={c.id} onClick={() => selectChat(c.id)} disabled={busy}
                        className={"group w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] transition-colors disabled:opacity-50 " +
                          (c.id === activeId ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50")}>
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate flex-1 min-w-0">{c.title}</span>
                        <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
                          onClick={(e) => deleteChat(e, c.id)} />
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <div className="flex-1 overflow-hidden">
                <Chat key="chat" activeChat={activeChat} onUpdateChat={updateChat} onNewChat={newChat}
                  onJump={jump} onCorpusStatus={setCorpusStatus} onBusyChange={setBusy} />
              </div>
            </div>
          ) : (
            <div className="flex h-full">
              <div className="hidden md:block w-64 border-r shrink-0">
                <div className="p-3 overflow-y-auto h-full">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-2 pb-2">California Codes</div>
                  {codes.map((c) => (
                    <button key={c.abbr} onClick={() => { setActiveCode(c.abbr); setJumpSection(null); }}
                      className={"w-full flex justify-between items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-left transition-colors " +
                        (activeCode === c.abbr ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50")}>
                      <span className="truncate">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{c.sections.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Browser activeCode={activeCode} jumpSection={jumpSection}
                  onCodeChange={(a) => { setActiveCode(a); setJumpSection(null); }} />
              </div>
            </div>
          )}
        </div>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>AI settings</DialogTitle>
              <DialogDescription>
                Sarvam AI is built in and ready. Dolphin (unfiltered) runs on OpenRouter - add a key from{" "}
                <a className="underline" href="https://openrouter.ai/keys" target="_blank" rel="noopener">OpenRouter</a>,{" "}
                <a className="underline" href="https://dashboard.sarvam.ai" target="_blank" rel="noopener">Sarvam</a> or{" "}
                <a className="underline" href="https://console.mistral.ai" target="_blank" rel="noopener">Mistral</a>.
                A free <a className="underline" href="https://www.courtlistener.com" target="_blank" rel="noopener">CourtListener</a> token unlocks full case-law search.
                Keys are stored only in your browser.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Engine</Label>
                <Select value={sProvider} onValueChange={(v) => { setSProvider(v); setSModel(store.model(v)); setSKey(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROVIDERS).map(([k, p]) => (
                      <SelectItem key={k} value={k}>{p.label}{p.builtinKey ? " (built in)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="s-model">Model</Label>
                <Input id="s-model" value={sModel} onChange={(e) => setSModel(e.target.value)} placeholder="model id" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="s-key">API key (not needed for Sarvam or the free engine)</Label>
                <Input id="s-key" type="password" value={sKey} onChange={(e) => setSKey(e.target.value)} placeholder="paste key" />
              </div>
              <Separator />
              <div className="grid gap-2">
                <Label htmlFor="s-cl">CourtListener token (optional, free)</Label>
                <Input id="s-cl" type="password" value={sCl} onChange={(e) => setSCl(e.target.value)} placeholder="paste CourtListener token" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSettingsOpen(false)}>Cancel</Button>
              <Button onClick={saveSettings}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
