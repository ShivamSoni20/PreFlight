import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Copy, Download, ArrowRight, ChevronDown } from "lucide-react";
import type { AuditCheck, AuditReport, CheckStatus } from "@/lib/preflight-types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function StatusIcon({ status, className }: { status: CheckStatus; className?: string }) {
  const map = {
    pass: <CheckCircle2 className={cn("text-pass", className)} />,
    warn: <AlertTriangle className={cn("text-amber", className)} />,
    fail: <XCircle className={cn("text-coral", className)} />,
    info: <Loader2 className={cn("text-cyan", className)} />,
  };
  return map[status];
}

export function ScoreGauge({ score, readiness }: { score: number; readiness: string }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setDisplayed(Math.round(p * score));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const color =
    score >= 90 ? "var(--pass)" :
    score >= 75 ? "var(--lime)" :
    score >= 50 ? "var(--amber)" :
    "var(--coral)";

  const circumference = 2 * Math.PI * 70;
  const offset = circumference - (displayed / 100) * circumference;

  return (
    <div className="relative grid place-items-center">
      <svg width="180" height="180" viewBox="0 0 160 160" className="-rotate-90">
        <circle cx="80" cy="80" r="70" stroke="var(--panel-2)" strokeWidth="10" fill="none" />
        <circle
          cx="80" cy="80" r="70" stroke={color} strokeWidth="10" fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-mono text-5xl font-bold tabular-nums" style={{ color }}>{displayed}</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{readiness}</div>
        </div>
      </div>
    </div>
  );
}

export function SummaryCards({
  report, filter, onFilter,
}: {
  report: AuditReport;
  filter: CheckStatus | "all";
  onFilter: (f: CheckStatus | "all") => void;
}) {
  const items = [
    { key: "pass" as const, label: "Passed", value: report.summary.passed, color: "text-pass", bg: "bg-pass/10 border-pass/30" },
    { key: "warn" as const, label: "Warnings", value: report.summary.warnings, color: "text-amber", bg: "bg-amber/10 border-amber/30" },
    { key: "fail" as const, label: "Failed", value: report.summary.failed, color: "text-coral", bg: "bg-coral/10 border-coral/30" },
    { key: "all" as const, label: "Response", value: `${report.durationMs}ms`, color: "text-cyan", bg: "bg-cyan/10 border-cyan/30", isTime: true },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(item => (
        <button
          key={item.label}
          onClick={() => !item.isTime && onFilter(filter === item.key ? "all" : item.key)}
          className={cn(
            "text-left rounded-xl border bg-panel px-4 py-3 transition-all",
            item.bg,
            filter === item.key && !item.isTime && "ring-2 ring-lime/60"
          )}
        >
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{item.label}</div>
          <div className={cn("mt-1 font-mono text-2xl font-bold tabular-nums", item.color)}>{item.value}</div>
        </button>
      ))}
    </div>
  );
}

export function CheckCard({ check }: { check: AuditCheck }) {
  const [open, setOpen] = useState(check.status === "fail");
  const border =
    check.status === "pass" ? "border-pass/25" :
    check.status === "warn" ? "border-amber/30" :
    check.status === "fail" ? "border-coral/40" : "border-border";

  return (
    <div className={cn("rounded-xl border bg-panel", border)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <StatusIcon status={check.status} className="h-5 w-5 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{check.name}</span>
            <span className="text-[10px] font-mono uppercase tracking-wider rounded border border-border px-1.5 py-0.5 text-muted-foreground">
              {check.category}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{check.message}</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 mt-1 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
      </button>
      {open && (check.evidence || check.expected || check.actual || check.fix) && (
        <div className="border-t border-border p-4 space-y-3 text-sm">
          {check.expected && (
            <Field label="Expected"><code className="font-mono text-cyan break-all">{check.expected}</code></Field>
          )}
          {check.actual && (
            <Field label="Actual"><code className="font-mono text-foreground break-all">{check.actual}</code></Field>
          )}
          {check.evidence && (
            <Field label="Evidence">
              <pre className="font-mono text-xs bg-background border border-border rounded-md p-3 overflow-x-auto max-h-48">{check.evidence}</pre>
            </Field>
          )}
          {check.fix && (
            <div className="flex items-start gap-2 rounded-md border border-lime/30 bg-lime/5 p-3">
              <ArrowRight className="h-4 w-4 text-lime mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase font-mono tracking-widest text-lime">Recommended fix</div>
                <div className="mt-1 text-sm text-foreground">{check.fix}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(check.fix ?? ""); toast.success("Fix copied"); }}
                className="text-muted-foreground hover:text-lime"
                aria-label="Copy fix"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function ManifestViewer({ manifest }: { manifest: NonNullable<AuditReport["probeManifest"]> }) {
  const [open, setOpen] = useState(false);
  if (!manifest || manifest.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-panel overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-panel-2 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-cyan animate-blink" />
          <span className="font-semibold text-sm">Probe Manifest ({manifest.length} operations)</span>
          <span className="text-[10px] font-mono uppercase tracking-wider rounded border border-border px-1.5 py-0.5 text-muted-foreground">
            Audit Provenance
          </span>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border/60 font-mono text-xs">
          {manifest.map((m, idx) => (
            <div key={`${m.tool}-${idx}`} className="p-3.5 flex flex-wrap items-center justify-between gap-2 bg-background/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-muted-foreground">#{idx + 1}</span>
                <span className="font-bold text-foreground">{m.tool}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider",
                    m.status === "ok" || !m.status ? "bg-pass/10 text-pass border border-pass/30" : "bg-coral/10 text-coral border border-coral/30"
                  )}
                >
                  {m.status || "ok"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                <span>{new Date(m.startedAt).toLocaleTimeString()}</span>
                <span className="text-cyan font-semibold">{m.durationMs}ms</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RecommendedFixes({ fixes }: { fixes: NonNullable<AuditReport["fixes"]> }) {
  if (!fixes || fixes.length === 0) return null;

  return (
    <div className="rounded-xl border border-lime/40 bg-lime/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ArrowRight className="h-4 w-4 text-lime" />
        <span className="text-xs font-mono uppercase tracking-widest text-lime font-bold">
          Recommended Fixes ({fixes.length})
        </span>
      </div>

      <div className="space-y-3">
        {fixes.map((f, idx) => (
          <div key={`${f.checkId}-${idx}`} className="rounded-lg border border-border bg-panel p-3 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-cyan">{f.checkId}</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-panel-2 px-1.5 py-0.5 rounded">
                Confidence: {f.confidence}
              </span>
            </div>
            <p className="text-foreground leading-relaxed font-mono text-xs">{f.fix}</p>
            {f.sources && f.sources.length > 0 && (
              <div className="pt-1 flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] uppercase font-mono text-muted-foreground">Sources:</span>
                {f.sources.map((s, sIdx) => (
                  <span key={sIdx} className="text-[10px] font-mono text-muted-foreground bg-background border border-border px-1.5 py-0.5 rounded">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function JsonViewer({ data }: { data: unknown }) {
  const text = useMemo(() => JSON.stringify(data, null, 2), [data]);
  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-panel px-3 py-2">
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Raw report.json</span>
        <div className="flex gap-1">
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:border-lime hover:text-lime"
            onClick={() => { navigator.clipboard.writeText(text); toast.success("JSON copied"); }}
          >
            <Copy className="h-3 w-3" /> Copy
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:border-lime hover:text-lime"
            onClick={() => {
              const blob = new Blob([text], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "preflight-report.json";
              a.click(); URL.revokeObjectURL(url);
              toast.success("Downloaded");
            }}
          >
            <Download className="h-3 w-3" /> Download
          </button>
        </div>
      </div>
      <pre className="font-mono text-xs p-4 overflow-auto max-h-[540px] leading-relaxed">
        {syntaxHighlight(text)}
      </pre>
    </div>
  );
}

function syntaxHighlight(json: string) {
  const parts: React.ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*"(?:\s*:)?)|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?)/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(json)) !== null) {
    if (m.index > last) parts.push(json.slice(last, m.index));
    const [tok] = m;
    let cls = "text-foreground";
    if (m[1]) cls = tok.endsWith(":") ? "text-lime" : "text-cyan";
    else if (m[2]) cls = "text-amber";
    else if (m[3]) cls = "text-coral";
    parts.push(<span key={i++} className={cls}>{tok}</span>);
    last = m.index + tok.length;
  }
  if (last < json.length) parts.push(json.slice(last));
  return parts;
}
