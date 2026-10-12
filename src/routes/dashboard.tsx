import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  Play, RotateCcw, Sparkles, Radio, Github, BookOpen, Home, Info,
  Loader2, X, Terminal, AlertCircle, Server,
} from "lucide-react";
import { Navigation, Footer, PreflightLogo, DisclaimerBanner } from "@/components/preflight/shell";
import { ScoreGauge, SummaryCards, CheckCard, JsonViewer, ManifestViewer, RecommendedFixes } from "@/components/preflight/audit-ui";
import type { AuditReport, CheckCategory, CheckStatus } from "@/lib/preflight-types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const searchSchema = z.object({
  url: z.string().optional(),
  method: z.enum(["GET", "POST"]).optional(),
  demo: z.enum(["free", "broken", "valid"]).optional(),
});

export const Route = createFileRoute("/dashboard")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Dashboard — Preflight" },
      { name: "description", content: "Run a preflight audit on your free or x402-powered agent service endpoint." },
      { property: "og:title", content: "Preflight Dashboard" },
      { property: "og:description", content: "Endpoint preflight workspace for agent services." },
    ],
  }),
  component: DashboardPage,
});

const DEMOS = [
  { key: "free" as const, title: "Valid Free", url: "/api/demo/free", method: "GET" as const, desc: "Returns HTTP 200 with structured JSON." },
  { key: "broken" as const, title: "Broken x402", url: "/api/demo/broken-x402", method: "GET" as const, desc: "Returns HTTP 402 with a missing challenge." },
  { key: "valid" as const, title: "Valid x402 Structure", url: "/api/demo/valid-x402", method: "GET" as const, desc: "Structurally valid demonstration challenge (non-settlement)." },
];

function absoluteDemoUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

const SCAN_STEPS = [
  "Validating URL", "Resolving hostname", "Checking destination safety",
  "Connecting to endpoint", "Inspecting HTTP response", "Parsing JSON",
  "Detecting x402", "Validating payment fields", "Calculating score",
];

function DashboardPage() {
  const search = Route.useSearch();
  const [url, setUrl] = useState(search.url ?? "");
  const [method, setMethod] = useState<"GET" | "POST">(search.method ?? "GET");
  const [body, setBody] = useState("{}");
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Apply demo from URL
  useEffect(() => {
    if (search.demo) {
      const d = DEMOS.find(x => x.key === search.demo);
      if (d) { setUrl(absoluteDemoUrl(d.url)); setMethod(d.method); }
    }
  }, [search.demo]);

  // Auto-run if URL was passed from landing
  const didAutoRun = useRef(false);
  useEffect(() => {
    if (!didAutoRun.current && search.url && url) {
      didAutoRun.current = true;
      void runAudit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.url, url]);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - start), 100);
    const stepT = setInterval(() => setScanStep(s => Math.min(s + 1, SCAN_STEPS.length - 1)), 350);
    return () => { clearInterval(t); clearInterval(stepT); };
  }, [running]);

  async function runAudit() {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) { setError("Endpoint URL is required."); return; }
    try { new URL(trimmed); } catch { setError("Please provide a valid URL, including https://"); return; }

    let requestBody: unknown = undefined;
    if (method === "POST") {
      try { requestBody = body.trim() ? JSON.parse(body) : {}; }
      catch { setError("Request body is not valid JSON."); return; }
    }

    setRunning(true);
    setReport(null);
    setScanStep(0);
    setElapsed(0);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUrl: trimmed, method, requestBody }),
        signal: abortRef.current.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Audit failed (${res.status})`);
      setScanStep(SCAN_STEPS.length - 1);
      setReport(data as AuditReport);
    } catch (e: any) {
      if (e?.name === "AbortError") { setError("Audit cancelled."); }
      else setError(String(e?.message ?? e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navigation />
      <div className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 grid lg:grid-cols-[240px_1fr] gap-6">
        <Sidebar />
        <main className="min-w-0 space-y-6">
          <Header />
          <AuditForm
            url={url} setUrl={setUrl}
            method={method} setMethod={setMethod}
            body={body} setBody={setBody}
            onRun={runAudit} running={running}
            onClear={() => { setUrl(""); setBody("{}"); setReport(null); setError(null); }}
          />
          <DemoSelector onPick={(d) => { setUrl(absoluteDemoUrl(d.url)); setMethod(d.method); }} />
          {running && <ScanProgress step={scanStep} elapsed={elapsed} onCancel={() => abortRef.current?.abort()} />}
          {error && !running && <ErrorState message={error} onRetry={runAudit} />}
          {report && !running && <Results report={report} />}
          {!report && !running && !error && <EmptyState onRun={runAudit} />}
          <DisclaimerBanner />
        </main>
      </div>
      <Footer />
    </div>
  );
}

function Sidebar() {
  const items = [
    { icon: <Home className="h-4 w-4" />, label: "New audit", href: "/dashboard" },
    { icon: <Sparkles className="h-4 w-4" />, label: "Demo endpoints", href: "/dashboard", search: { demo: "free" as const } },
    { icon: <BookOpen className="h-4 w-4" />, label: "Documentation", href: "#" },
    { icon: <Github className="h-4 w-4" />, label: "GitHub", href: "https://github.com" },
    { icon: <Info className="h-4 w-4" />, label: "About", href: "/" },
  ];
  return (
    <aside className="hidden lg:flex flex-col rounded-xl border border-border bg-panel/50 p-4 sticky top-20 self-start">
      <div className="flex items-center gap-2 text-lime px-2 py-2">
        <PreflightLogo />
        <span className="font-semibold text-foreground">Preflight</span>
      </div>
      <nav className="mt-4 space-y-1">
        {items.map(it => (
          it.href.startsWith("http") || it.href === "#"
            ? <a key={it.label} href={it.href} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-panel-2 hover:text-foreground">{it.icon}{it.label}</a>
            : <Link key={it.label} to={it.href as any} search={(it as any).search} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-panel-2 hover:text-foreground">{it.icon}{it.label}</Link>
        ))}
      </nav>
      <div className="mt-auto pt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-pass animate-blink" />
        System operational
      </div>
    </aside>
  );
}

function Header() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="text-xs font-mono uppercase tracking-widest text-lime">Preflight</div>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">Endpoint Preflight</h1>
        <p className="mt-1 text-sm text-muted-foreground">Validate a free or x402-powered service before listing.</p>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 font-mono text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-pass animate-blink" /> API operational
        </span>
        <a href="#" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-1.5 hover:border-lime">
          <BookOpen className="h-3.5 w-3.5" /> Docs
        </a>
      </div>
    </div>
  );
}

function AuditForm({
  url, setUrl, method, setMethod, body, setBody, onRun, onClear, running,
}: {
  url: string; setUrl: (v: string) => void;
  method: "GET" | "POST"; setMethod: (m: "GET" | "POST") => void;
  body: string; setBody: (v: string) => void;
  onRun: () => void; onClear: () => void; running: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-panel-2/60 px-4 py-2.5">
        <Terminal className="h-3.5 w-3.5 text-lime" />
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Audit console</span>
      </div>
      <form onSubmit={e => { e.preventDefault(); onRun(); }} className="p-4 md:p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-[auto_1fr]">
          <div className="inline-flex rounded-md border border-border bg-background p-0.5 self-start">
            {(["GET", "POST"] as const).map(m => (
              <button key={m} type="button" onClick={() => setMethod(m)}
                className={cn("px-4 py-2.5 rounded text-sm font-mono font-semibold transition-colors",
                  method === m ? "bg-lime text-lime-foreground" : "text-muted-foreground hover:text-foreground")}>
                {m}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="endpoint" className="sr-only">Endpoint URL</label>
            <input
              id="endpoint"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://your-service.example/api"
              className="w-full min-w-0 rounded-md border border-border bg-background px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-lime focus:ring-2 focus:ring-lime/20"
            />
          </div>
        </div>
        {method === "POST" && (
          <div>
            <label htmlFor="body" className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Request body (JSON)</label>
            <textarea
              id="body"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={5}
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:border-lime"
              spellCheck={false}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md bg-lime px-5 py-2.5 text-sm font-semibold text-lime-foreground hover:opacity-90 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Running…" : "Run Preflight"}
          </button>
          <button type="button" onClick={onClear} className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm hover:border-lime">
            <RotateCcw className="h-4 w-4" /> Clear
          </button>
          <span className="text-xs text-muted-foreground ml-auto font-mono">
            {method === "POST" ? "POST + body" : "GET"} · timeout 5s
          </span>
        </div>
      </form>
    </div>
  );
}

function DemoSelector({ onPick }: { onPick: (d: typeof DEMOS[number]) => void }) {
  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Use a demo endpoint</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {DEMOS.map(d => (
          <button
            key={d.key}
            onClick={() => onPick(d)}
            className="text-left rounded-xl border border-border bg-panel p-4 hover:border-lime hover:bg-panel-2 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{d.title}</span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-lime">{d.method}</span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-muted-foreground truncate">{d.url}</div>
            <div className="mt-2 text-xs text-muted-foreground leading-relaxed">{d.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ScanProgress({ step, elapsed, onCancel }: { step: number; elapsed: number; onCancel: () => void }) {
  return (
    <div className="rounded-2xl border border-lime/30 bg-panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-panel-2/60 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-lime">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning endpoint
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          <span className="tabular-nums">{(elapsed / 1000).toFixed(1)}s</span>
          <button onClick={onCancel} className="inline-flex items-center gap-1 hover:text-coral"><X className="h-3.5 w-3.5" /> Cancel</button>
        </div>
      </div>
      <div className="p-5 font-mono text-sm space-y-1.5">
        {SCAN_STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "pending";
          return (
            <div key={s} className="flex items-center gap-3">
              <span className={cn("text-[10px] w-8", state === "done" ? "text-pass" : state === "active" ? "text-lime" : "text-muted-foreground/40")}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={cn("h-1.5 w-1.5 rounded-full",
                state === "done" ? "bg-pass" : state === "active" ? "bg-lime animate-blink" : "bg-muted-foreground/30")} />
              <span className={cn(state === "pending" ? "text-muted-foreground/50" : "text-foreground")}>
                {state === "done" && "✓ "}
                {state === "active" && "› "}
                {s}
                {state === "active" && <span className="animate-blink">_</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ onRun }: { onRun: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-panel/40 p-10 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-panel border border-border text-lime animate-pulse-ring">
        <Radio className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-lg font-semibold">Your next endpoint is waiting for inspection.</h3>
      <p className="mt-2 text-sm text-muted-foreground">Paste a URL above or pick a demo endpoint.</p>
      <button onClick={onRun} className="mt-5 inline-flex items-center gap-2 rounded-md bg-lime px-4 py-2 text-sm font-semibold text-lime-foreground">
        <Play className="h-4 w-4" /> Run your first preflight
      </button>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-coral/40 bg-coral/5 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-coral mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono uppercase tracking-widest text-coral">Preflight error</div>
          <h3 className="mt-1 font-semibold">We couldn't complete this audit.</h3>
          <p className="mt-2 text-sm text-muted-foreground break-words">{message}</p>
          <div className="mt-4 flex gap-2">
            <button onClick={onRetry} className="rounded-md bg-lime px-4 py-2 text-sm font-semibold text-lime-foreground">Rerun</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Results({ report }: { report: AuditReport }) {
  const [tab, setTab] = useState<"overview" | "checks" | "raw">("overview");
  const [statusFilter, setStatusFilter] = useState<CheckStatus | "all">("all");
  const [catFilter, setCatFilter] = useState<CheckCategory | "all">("all");

  const filtered = useMemo(() => report.checks.filter(c =>
    (statusFilter === "all" || c.status === statusFilter) &&
    (catFilter === "all" || c.category === catFilter)
  ), [report, statusFilter, catFilter]);

  const host = useMemo(() => { try { return new URL(report.targetUrl).host; } catch { return report.targetUrl; } }, [report.targetUrl]);

  const badgeColor =
    report.endpointType === "Free A2MCP" ? "bg-pass/15 border-pass/40 text-pass" :
    report.endpointType === "x402" ? "bg-lime/15 border-lime/40 text-lime" :
    report.endpointType === "Unreachable" ? "bg-coral/15 border-coral/40 text-coral" :
    "bg-muted border-border text-muted-foreground";

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-panel p-5">
        <div className="grid gap-5 md:grid-cols-[auto_1fr_auto] items-center">
          <ScoreGauge score={report.score} readiness={report.readiness} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono uppercase tracking-wider", badgeColor)}>
                <Server className="h-3 w-3 mr-1" /> {report.endpointType}
              </span>
              {report.httpStatus !== null && (
                <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-mono">
                  HTTP {report.httpStatus}
                </span>
              )}
              <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-mono">
                {report.durationMs}ms
              </span>
            </div>
            <h2 className="mt-3 text-xl md:text-2xl font-bold tracking-tight font-mono truncate">{host}</h2>
            <p className="mt-1 text-xs text-muted-foreground font-mono truncate">{report.targetUrl}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Audited {new Date(report.auditedAt).toLocaleString()}</p>
          </div>
          <button
            onClick={() => { toast("Rerun triggered"); window.dispatchEvent(new Event("preflight:rerun")); }}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:border-lime"
          >
            Rerun
          </button>
        </div>
      </div>

      <SummaryCards report={report} filter={statusFilter} onFilter={setStatusFilter} />

      {/* Tabs */}
      <div className="rounded-2xl border border-border bg-panel">
        <div className="flex items-center gap-1 border-b border-border p-1.5 overflow-x-auto">
          {(["overview", "checks", "raw"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("px-3 py-1.5 rounded-md text-sm font-mono transition-colors",
                tab === t ? "bg-lime text-lime-foreground font-semibold" : "text-muted-foreground hover:text-foreground")}
            >
              {t === "overview" ? "Overview" : t === "checks" ? `Checks (${report.checks.length})` : "Raw JSON"}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-5">
          {tab === "overview" && <Overview report={report} onJumpChecks={() => setTab("checks")} />}
          {tab === "checks" && (
            <div className="space-y-4">
              <CategoryFilters catFilter={catFilter} setCatFilter={setCatFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
              <div className="space-y-2">
                {filtered.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No checks match these filters.</div>
                ) : filtered.map(c => <CheckCard key={c.id} check={c} />)}
              </div>
            </div>
          )}
          {tab === "raw" && <JsonViewer data={report} />}
        </div>
      </div>
    </div>
  );
}

function Overview({ report, onJumpChecks }: { report: AuditReport; onJumpChecks: () => void }) {
  const failing = report.checks.filter(c => c.status === "fail").slice(0, 3);
  const warning = report.checks.filter(c => c.status === "warn").slice(0, 3);
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Readiness</div>
        <p className="text-sm leading-relaxed">
          <span className="text-lime font-semibold">{report.readiness}.</span>{" "}
          {report.summary.failed > 0 && `${report.summary.failed} failing check${report.summary.failed > 1 ? "s" : ""} must be addressed. `}
          {report.summary.failed === 0 && report.summary.warnings > 0 && `${report.summary.warnings} warning${report.summary.warnings > 1 ? "s" : ""} recommended. `}
          {report.summary.failed === 0 && report.summary.warnings === 0 && "All checks passed."}
        </p>
      </div>
      {(failing.length > 0 || warning.length > 0) && (
        <div className="grid md:grid-cols-2 gap-3">
          {failing.length > 0 && (
            <div className="rounded-xl border border-coral/30 bg-coral/5 p-4">
              <div className="text-xs font-mono uppercase tracking-widest text-coral">Failures</div>
              <ul className="mt-2 space-y-1.5 text-sm">
                {failing.map(f => <li key={f.id} className="flex gap-2"><span className="text-coral">●</span>{f.name}</li>)}
              </ul>
            </div>
          )}
          {warning.length > 0 && (
            <div className="rounded-xl border border-amber/30 bg-amber/5 p-4">
              <div className="text-xs font-mono uppercase tracking-widest text-amber">Warnings</div>
              <ul className="mt-2 space-y-1.5 text-sm">
                {warning.map(f => <li key={f.id} className="flex gap-2"><span className="text-amber">●</span>{f.name}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {report.fixes && report.fixes.length > 0 && (
        <RecommendedFixes fixes={report.fixes} />
      )}

      {report.probeManifest && report.probeManifest.length > 0 && (
        <ManifestViewer manifest={report.probeManifest} />
      )}

      <button onClick={onJumpChecks} className="text-sm font-mono text-lime hover:underline">View all checks →</button>
    </div>
  );
}

function CategoryFilters({
  catFilter, setCatFilter, statusFilter, setStatusFilter,
}: {
  catFilter: CheckCategory | "all"; setCatFilter: (c: CheckCategory | "all") => void;
  statusFilter: CheckStatus | "all"; setStatusFilter: (s: CheckStatus | "all") => void;
}) {
  const cats: (CheckCategory | "all")[] = ["all", "Connectivity", "HTTP", "x402", "X Layer"];
  const statuses: (CheckStatus | "all")[] = ["all", "pass", "warn", "fail"];
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mr-1">Status</span>
        {statuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={cn("px-2.5 py-1 rounded text-xs font-mono border transition-colors",
            statusFilter === s ? "border-lime bg-lime/10 text-lime" : "border-border text-muted-foreground hover:text-foreground")}>
            {s}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mr-1">Category</span>
        {cats.map(c => (
          <button key={c} onClick={() => setCatFilter(c)} className={cn("px-2.5 py-1 rounded text-xs font-mono border transition-colors",
            catFilter === c ? "border-lime bg-lime/10 text-lime" : "border-border text-muted-foreground hover:text-foreground")}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
