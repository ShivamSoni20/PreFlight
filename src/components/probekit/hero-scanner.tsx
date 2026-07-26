import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const SCAN_STEPS = [
  "Resolving endpoint",
  "Checking HTTPS",
  "Calling service",
  "Inspecting HTTP 402",
  "Decoding PAYMENT-REQUIRED",
  "Validating X Layer fields",
  "Generating report",
];

export function HeroScanner() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    if (step >= SCAN_STEPS.length) { setDone(true); return; }
    const t = setTimeout(() => setStep(s => s + 1), 550);
    return () => clearTimeout(t);
  }, [step, done]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => { setStep(0); setDone(false); }, 2600);
    return () => clearTimeout(t);
  }, [done]);

  return (
    <div className="relative rounded-2xl border border-border bg-panel/60 backdrop-blur overflow-hidden shadow-[0_0_60px_-20px_rgba(163,255,79,0.25)]">
      {/* Terminal chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-panel px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-coral/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-pass/70" />
        <span className="ml-3 font-mono text-xs text-muted-foreground truncate">
          probekit://scan/https://api.example.com/agents/search
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-lime">
          <span className="h-1.5 w-1.5 rounded-full bg-lime animate-blink" /> live
        </span>
      </div>

      <div className="relative p-5 font-mono text-sm space-y-1.5 min-h-[380px]">
        {/* Scan line */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-lime/10 to-transparent animate-scan" />

        {SCAN_STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "pending";
          return (
            <div key={s} className="flex items-center gap-3">
              <span className={cn(
                "font-mono text-[10px] w-8 shrink-0",
                state === "done" ? "text-pass" : state === "active" ? "text-lime" : "text-muted-foreground/50",
              )}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                state === "done" ? "bg-pass" : state === "active" ? "bg-lime animate-blink" : "bg-muted-foreground/30",
              )} />
              <span className={cn(
                "truncate",
                state === "done" ? "text-foreground/80" : state === "active" ? "text-foreground" : "text-muted-foreground/50",
              )}>
                {state === "done" && "✓ "}
                {state === "active" && "› "}
                {s}
                {state === "active" && <span className="animate-blink">_</span>}
              </span>
            </div>
          );
        })}

        {done && (
          <div className="mt-6 rounded-lg border border-lime/40 bg-lime/10 p-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-lime">Report</div>
                <div className="text-lg font-semibold mt-0.5 text-foreground">Protocol Ready</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-mono font-bold text-lime tabular-nums text-glow-lime">94</div>
                <div className="text-[10px] text-muted-foreground">/ 100</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
