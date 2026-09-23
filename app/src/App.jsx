import React, { useEffect, useState } from "react";
import { Scale, Settings, Sun, Moon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import Chat from "@/components/Chat";
import Browser from "@/components/Browser";
import { codes, byAbbr, loadCorpus, corpusReady, PROVIDERS, store, getModel } from "@/lib/engine";

export default function App() {
  const [tab, setTab] = useState("ai");
  const [engine, setEngine] = useState(store.provider);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [activeCode, setActiveCode] = useState(null);
  const [jumpSection, setJumpSection] = useState(null);
  const [corpusStatus, setCorpusStatus] = useState("Loading the California Codes…");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    loadCorpus(setCorpusStatus).then((ok) => {
      setCorpusStatus(ok ? "ready" : "error");
    }).catch(() => setCorpusStatus("error"));
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const jump = (abbr, section) => {
    setActiveCode(abbr);
    setJumpSection(section);
    setTab("codes");
  };

  // settings form state (seeded when dialog opens)
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

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <div className="flex items-center gap-2 font-bold cursor-pointer select-none" onClick={() => setTab("ai")}>
            <Scale className="h-5 w-5 brand-color" />
            <span>CA <span className="brand-color">Leg Info</span></span>
          </div>
          <Tabs value={tab} onValueChange={setTab} className="ml-2">
            <TabsList>
              <TabsTrigger value="ai">Ask AI</TabsTrigger>
              <TabsTrigger value="codes">Browse Codes</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1" />
          <div className="hidden sm:block">
            {tab === "ai" && (
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {corpusStatus === "ready" ? "✓ 162,324 sections loaded" :
                 corpusStatus === "error" ? "corpus unavailable" : corpusStatus}
              </Badge>
            )}
          </div>
          <Select value={engine} onValueChange={(v) => { store.provider = v; setEngine(v); if (PROVIDERS[v].needsKey && !store.key(v)) openSettings(); }}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROVIDERS).map(([k, p]) => (
                <SelectItem key={k} value={k} className="text-xs">AI: {p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={openSettings} title="AI settings"><Settings className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme} title="Theme">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {tab === "ai" ? (
          <Chat onJump={jump} onCorpusStatus={setCorpusStatus} />
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
              <Browser activeCode={activeCode} jumpSection={jumpSection} />
            </div>
          </div>
        )}
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>AI settings</DialogTitle>
            <DialogDescription>
              Sarvam AI is built in and ready. To use another engine instead, add a key from{" "}
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
  );
}
