import * as RadioGroup from "@radix-ui/react-radio-group";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StepFooter, StepHeader } from "@/components/StepShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";

export function KeyStep() {
  const { provider, apiKey, model, baseUrl, connected, setSettings, setStep } = useStore();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = provider === "ollama" ? !!model : !!apiKey;

  const test = async () => {
    setBusy(true);
    try {
      await api.testConnection();
      setSettings({ connected: true });
      toast.success("Connected", { description: `${provider === "ollama" ? "Ollama" : "Anthropic"} is responding.` });
    } catch (e) {
      setSettings({ connected: false });
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const pick = (p: "anthropic" | "ollama") =>
    p !== provider && setSettings({ provider: p, connected: false, model: p === "anthropic" ? "claude-sonnet-5-5" : "llama3.1" });

  return (
    <div>
      <StepHeader id="key" icon={KeyRound} title="Bring your own brain" subtitle="Connect your own model. Your key lives only in this tab's memory and is sent per request, never stored." />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="space-y-5">
          {/* Radix RadioGroup gives roving focus + arrow-key navigation. The pill slides via x, not a shared layoutId,
              so it can never get stuck inside an exiting AnimatePresence subtree. */}
          <RadioGroup.Root aria-label="Provider" value={provider} onValueChange={(v) => pick(v as "anthropic" | "ollama")}
            onKeyDown={(e) => {
              // Radix moves focus on arrow keys; select the focused option too (radio-group semantics).
              const next = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
              if (next) { e.preventDefault(); const order = ["anthropic", "ollama"] as const; const to = order[(order.indexOf(provider) + next + 2) % 2]; pick(to); document.getElementById(`prov-${to}`)?.focus(); }
            }}
            className="glass relative grid grid-cols-2 gap-1 rounded-xl p-1">
            <motion.span aria-hidden className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-primary"
              animate={{ x: provider === "anthropic" ? 0 : "100%" }} transition={{ type: "spring", stiffness: 380, damping: 32 }} />
            {(["anthropic", "ollama"] as const).map((p) => (
              <RadioGroup.Item key={p} value={p} id={`prov-${p}`}
                className={cn("relative rounded-lg py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", provider === p ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {p === "anthropic" ? "Anthropic" : "Ollama (local)"}
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
          {provider === "anthropic" ? (
            <div>
              <Label htmlFor="key">API key</Label>
              <div className="relative">
                <Input id="key" type={show ? "text" : "password"} autoComplete="off" spellCheck={false} placeholder="sk-ant-…" value={apiKey}
                  onChange={(e) => setSettings({ apiKey: e.target.value, connected: false })} className="pr-11" />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide key" : "Show key"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="url">Ollama URL</Label>
              <Input id="url" value={baseUrl} onChange={(e) => setSettings({ baseUrl: e.target.value, connected: false })} placeholder="Leave empty to use the server default (OLLAMA_URL)" />
              <p className="mt-1.5 text-xs text-muted-foreground">Only hosts allowed by the server (ALLOWED_OLLAMA_HOSTS) are accepted, e.g. http://localhost:11434.</p>
            </div>
          )}
          <div>
            <Label htmlFor="model">Model</Label>
            <Input id="model" value={model} onChange={(e) => setSettings({ model: e.target.value, connected: false })} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="glass" onClick={test} disabled={!ready || busy}>
              {busy ? <Loader2 className="animate-spin" /> : connected ? <CheckCircle2 className="text-success" /> : <Zap />}
              {connected ? "Connected" : "Test connection"}
            </Button>
            {connected && <span className="text-sm text-success">Ready to go</span>}
          </div>
        </Card>
        <Card className="space-y-3 text-sm">
          <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5 text-success" />Stateless by design</div>
          <ul className="space-y-2 text-muted-foreground">
            <li>No database, no accounts, no server-side files.</li>
            <li>Your key is never logged or echoed back.</li>
            <li>Nothing is written to localStorage, sessionStorage or cookies.</li>
            <li>Refresh the tab and everything is gone. Use <b className="text-foreground">Save session</b> to resume later (key excluded).</li>
          </ul>
        </Card>
      </div>
      <StepFooter>
        <span />
        <Button size="lg" disabled={!ready} onClick={() => setStep(1)}>Continue <ArrowRight /></Button>
      </StepFooter>
    </div>
  );
}
