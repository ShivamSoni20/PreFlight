import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  Play, RotateCcw, Sparkles, Radio, Github, BookOpen, Home, Info,
  Loader2, X, AlertCircle, Server, CheckCircle2, ChevronRight
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
  "Validating URL format & scheme",
  "Resolving DNS via DoH resolver",
  "Checking destination safety (SSRF block)",
  "Connecting to public endpoint",
  "Inspecting HTTP response headers",
  "Parsing JSON payload body",
  "Detecting x402 payment challenge",
  "Validating CAIP-2 & X Layer fields",
  "Aggregating score & evidence",
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
  const resultsRef = useRef<HTMLDivElement | null>(null);

  // Apply demo from URL
  useEffect(() => {
    if (search.demo) {
      const d = DEMOS.find((x) => x.key === search.demo);
      if (d) {
        setUrl(absoluteDemoUrl(d.url));
        setMethod(d.method);
      }
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
    const stepT = setInterval(() => setScanStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1)), 400);
    return () => {
      clearInterval(t);
      clearInterval(stepT);
    };
  }, [running]);

  async function runAudit() {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Endpoint URL is required.");
      return;
    }
    try {
      new URL(trimmed);
    } catch {
      setError("Please provide a complete URL including https://");
      return;
    }

    let requestBody: unknown = undefined;
    if (method === "POST") {
      try {
        requestBody = body.trim() ? JSON.parse(body) : {};
      } catch {
        setError("Request body is not valid JSON.");
        return;
      }
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
      if (!res.ok) throw new Error(data?.error || data?.message || `Audit failed (${res.status})`);
      setScanStep(SCAN_STEPS.length - 1);
      setReport(data as AuditReport);

      // Auto scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setError("Audit was cancelled.");
      } else {
        setError(String(e?.message ?? e));
      }
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
            url={url}
            setUrl={setUrl}
            method={method}
            setMethod={setMethod}
            body={body}
            setBody={setBody}
            onRun={runAudit}
            running={running}
            onClear={() => {
              setUrl("");
              setBody("{}");
              setReport(null);
              setError(null);
            }}
          />

          {running && <ScanProgress step={scanStep} elapsed={elapsed} onCancel={() => abortRef.current?.abort()} />}
          {error && !running && <HumanErrorState message={error} onRetry={runAudit} />}
          
          <div ref={resultsRef}>
            {report && !running && <Results report={report} onRerun={runAudit} />}
          </div>

          {!report && !running && !error && (
            <FriendlyEmptyState
              onSelectDemo={(demoKey) => {
                const d = DEMOS.find((x) => x.key === demoKey);
                if (d) {
                  setUrl(absoluteDemoUrl(d.url));
                  setMethod(d.method);
                }
              }}
            />
          )}

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
    { icon: <BookOpen className="h-4 w-4" />, label: "Documentation", href: "https://github.com/ShivamSoni20/Preflight#readme" },
    { icon: <Github className="h-4 w-4" />, label: "GitHub", href: "https://github.com/ShivamSoni20/Preflight" },
    { icon: <Info className="h-4 w-4" />, label: "About", href: "/" },
  ];
  return (
    <aside className="hidden lg:flex flex-col rounded-xl border border-border bg-panel/50 p-4 sticky top-20 self-start">
      <div className="flex items-center gap-2 text-lime px-2 py-2">
        <PreflightLogo />
        <span className="font-semibold text-foreground">Preflight</span>
      </div>
      <nav className="mt-4 space-y-1">
        {items.map((it) =>
          it.href.startsWith("http")
            ? (
              <a
                key={it.label}
                href={it.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-panel-2 hover:text-foreground focus-visible:ring-1 focus-visible:ring-lime"
              >
                {it.icon}
                {it.label}
              </a>
            )
            : (
              <Link
                key={it.label}
                to={it.href as any}
                search={(it as any).search}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-panel-2 hover:text-foreground focus-visible:ring-1 focus-visible:ring-lime"
              >
                {it.icon}
                {it.label}
              </Link>
            )
        )}
      </nav>
      <div className="mt-auto pt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-pass animate-blink" />
        Preflight Engine operational
      </div>
    </aside>
  );
}

function Header() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="text-xs font-mono uppercase tracking-widest text-lime">Preflight Check</div>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">Endpoint Preflight</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Validate your machine-callable agent service before submitting to the marketplace.
        </p>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 font-mono text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-pass animate-blink" /> Engine v2.0
        </span>
      </div>
    </div>
  );
}

function AuditForm({
  url, setUrl, method, setMethod, body, setBody, onRun, running, onClear,
}: {
  url: string; setUrl: (u: string) => void;
  method: "GET" | "POST"; setMethod: (m: "GET" | "POST") => void;
  body: string; setBody: (b: string) => void;
  onRun: () => void; running: boolean; onClear: () => void;
}) {
  const [showBody, setShowBody] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-panel p-5">
      <form onSubmit={(e) => { e.preventDefault(); onRun(); }} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="inline-flex rounded-md border border-border bg-background p-0.5 shrink-0 self-start">
            {(["GET", "POST"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMethod(m); if (m === "POST") setShowBody(true); }}
                className={cn(
                  "px-3 py-2 rounded text-xs font-mono font-semibold transition-colors focus-visible:ring-1 focus-visible:ring-lime",
                  method === m ? "bg-lime text-lime-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>

          <input
            id="url-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-agent.example.com/api"
            className="flex-1 rounded-md border border-border bg-background px-3.5 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
            required
          />

          <button
            type="submit"
            disabled={running}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-lime px-5 py-2.5 text-sm font-semibold text-lime-foreground hover:opacity-90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-lime shrink-0 transition-all shadow-[0_0_16px_rgba(163,255,79,0.2)]"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Scanning…" : "Run Preflight"}
          </button>
        </div>

        {method === "POST" && (
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <label htmlFor="body" className="font-mono uppercase tracking-wider">JSON Request Payload</label>
              <button
                type="button"
                onClick={() => setShowBody((v) => !v)}
                className="text-lime hover:underline"
              >
                {showBody ? "Hide body" : "Show body"}
              </button>
            </div>
            {showBody && (
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                spellCheck={false}
              />
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 hover:text-foreground focus-visible:ring-1 focus-visible:ring-lime rounded"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Clear inputs
          </button>
          <span className="font-mono text-[11px]">
            {method === "POST" ? "HTTP POST" : "HTTP GET"} · 5s budget · egress check
          </span>
        </div>
      </form>
    </div>
  );
}

function FriendlyEmptyState({ onSelectDemo }: { onSelectDemo: (key: "free" | "broken" | "valid") => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-panel/30 p-8 sm:p-12 text-center space-y-6">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-panel border border-border text-lime animate-pulse-ring">
        <Radio className="h-7 w-7" />
      </div>

      <div className="max-w-md mx-auto space-y-2">
        <h3 className="text-xl font-bold tracking-tight">Paste your endpoint URL to begin</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Preflight safely probes your endpoint from the outside. No wallet connection, no secrets, no accounts needed.
        </p>
      </div>

      <div className="pt-2">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Or try a demo fixture:
        </div>
        <div className="grid gap-3 sm:grid-cols-3 max-w-2xl mx-auto">
          {DEMOS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => onSelectDemo(d.key)}
              className="text-left rounded-xl border border-border bg-panel p-4 hover:border-lime hover:bg-panel-2 transition-all focus-visible:ring-2 focus-visible:ring-lime"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{d.title}</span>
                <ChevronRight className="h-3.5 w-3.5 text-lime" />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{d.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScanProgress({ step, elapsed, onCancel }: { step: number; elapsed: number; onCancel: () => void }) {
  const percent = Math.min(100, Math.round(((step + 1) / SCAN_STEPS.length) * 100));

  return (
    <div className="rounded-2xl border border-lime/40 bg-panel overflow-hidden shadow-lg animate-fade-up">
      {/* Determinate progress bar */}
      <div className="h-1.5 w-full bg-background overflow-hidden">
        <div
          className="h-full bg-lime transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between border-b border-border bg-panel-2/70 px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-lime">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Probing endpoint ({percent}%)
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          <span className="tabular-nums">{(elapsed / 1000).toFixed(1)}s elapsed</span>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1 hover:text-coral focus-visible:ring-1 focus-visible:ring-coral rounded px-1"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      </div>

      <div className="p-5 font-mono text-xs sm:text-sm space-y-2">
        {SCAN_STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "pending";
          return (
            <div key={s} className="flex items-center gap-3">
              <span
                className={cn(
                  "text-[10px] w-6 shrink-0",
                  state === "done" ? "text-pass" : state === "active" ? "text-lime" : "text-muted-foreground/40"
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  state === "done" ? "bg-pass" : state === "active" ? "bg-lime animate-blink" : "bg-muted-foreground/30"
                )}
              />
              <span className={cn("truncate", state === "pending" ? "text-muted-foreground/50" : "text-foreground")}>
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

function HumanErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const isPrivateIp = message.toLowerCase().includes("private") || message.toLowerCase().includes("reserved");
  const isTimeout = message.toLowerCase().includes("timeout") || message.toLowerCase().includes("5 second");
  const isInvalidUrl = message.toLowerCase().includes("valid url");

  let whatHappened = "Preflight could not complete the network probe.";
  let whyItMatters = "An endpoint must be publicly reachable with valid HTTPS to work in the agent economy.";
  let whatToDo = "Check the endpoint URL and ensure it is exposed publicly.";

  if (isPrivateIp) {
    whatHappened = "Destination resolved to a private or internal IP address.";
    whyItMatters = "Marketplace agents run from public cloud nodes and cannot reach localhost, 127.0.0.1, or private VPCs.";
    whatToDo = "Deploy your service to a public host with a public DNS record (e.g. via Vercel, Railway, Fly.io).";
  } else if (isTimeout) {
    whatHappened = "The endpoint took longer than 5 seconds to initiate response headers.";
    whyItMatters = "Autonomous agents have strict execution deadlines and drop hanging services.";
    whatToDo = "Optimize cold starts and handler latency to respond well under 1,500ms.";
  } else if (isInvalidUrl) {
    whatHappened = "The provided string is not a valid absolute URL.";
    whyItMatters = "Agent protocol clients require canonical https:// URLs.";
    whatToDo = "Include the full scheme and hostname (e.g., https://api.yourdomain.com/v1/agent).";
  }

  return (
    <div className="rounded-2xl border border-coral/40 bg-coral/5 p-6 space-y-4 animate-fade-up">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-coral mt-0.5 shrink-0" />
        <div className="flex-1 space-y-1">
          <div className="text-xs font-mono uppercase tracking-widest text-coral font-bold">Probe Interrupted</div>
          <h3 className="text-base font-semibold text-foreground">{whatHappened}</h3>
          <p className="text-xs font-mono text-coral/80 bg-background/50 p-2 rounded border border-coral/20">
            {message}
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-xs pt-1">
        <div className="rounded-lg border border-border bg-background p-3 space-y-1">
          <div className="font-semibold text-foreground">Why this matters</div>
          <p className="text-muted-foreground leading-relaxed">{whyItMatters}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-3 space-y-1">
          <div className="font-semibold text-foreground">Next steps</div>
          <p className="text-muted-foreground leading-relaxed">{whatToDo}</p>
        </div>
      </div>

      <div className="pt-1 flex gap-2">
        <button
          onClick={onRetry}
          className="rounded-md bg-lime px-4 py-2 text-xs font-semibold text-lime-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-lime"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function Results({ report, onRerun }: { report: AuditReport; onRerun: () => void }) {
  const [activeTab, setActiveTab] = useState<"checks" | "fixes" | "manifest" | "raw">("checks");
  const [statusFilter, setStatusFilter] = useState<CheckStatus | "all">("all");
  const [catFilter, setCatFilter] = useState<CheckCategory | "all">("all");

  const host = useMemo(() => {
    try {
      return new URL(report.targetUrl).host;
    } catch {
      return report.targetUrl;
    }
  }, [report.targetUrl]);

  const filteredChecks = useMemo(() => {
    return report.checks.filter(
      (c) =>
        (statusFilter === "all" || c.status === statusFilter) &&
        (catFilter === "all" || c.category === catFilter)
    );
  }, [report.checks, statusFilter, catFilter]);

  const failingChecks = useMemo(() => report.checks.filter((c) => c.status === "fail"), [report.checks]);

  const categoryGroups = useMemo(() => {
    const map: Record<string, typeof report.checks> = {};
    for (const c of filteredChecks) {
      if (!map[c.category]) map[c.category] = [];
      map[c.category].push(c);
    }
    return map;
  }, [filteredChecks]);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Hero Score Gauge Display */}
      <div className="rounded-2xl border border-border bg-panel p-6 sm:p-8 text-center space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4 text-xs">
          <div className="flex items-center gap-2 font-mono">
            <span className="font-bold text-foreground truncate max-w-xs">{host}</span>
            <span className="text-muted-foreground truncate hidden sm:inline">({report.targetUrl})</span>
          </div>
          <button
            onClick={onRerun}
            className="rounded-md border border-border bg-background px-3 py-1.5 hover:border-lime hover:text-lime transition-colors"
          >
            Rerun audit
          </button>
        </div>

        <div className="py-2 flex flex-col items-center justify-center">
          <ScoreGauge score={report.score} readiness={report.readiness} />
          <h2 className="mt-4 text-2xl font-bold tracking-tight">{report.readiness}</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">
            {report.score >= 90
              ? "All fundamental protocol, network, and security invariants validated successfully."
              : report.score >= 75
              ? "Service is functional but contains warnings that should be addressed before marketplace listing."
              : "Critical failures prevent autonomous agent systems from interacting with this service."}
          </p>
        </div>

        <SummaryCards report={report} filter={statusFilter} onFilter={setStatusFilter} />
      </div>

      {/* Tabbed Section */}
      <div className="rounded-2xl border border-border bg-panel overflow-hidden">
        <div className="flex items-center gap-1 border-b border-border p-2 overflow-x-auto bg-panel-2/30">
          {[
            { id: "checks", label: `Checks (${report.checks.length})` },
            { id: "fixes", label: `Recommended fixes (${report.fixes?.length ?? 0})` },
            { id: "manifest", label: `Probe manifest (${report.probeManifest?.length ?? 0})` },
            { id: "raw", label: "Raw JSON" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={cn(
                "px-3.5 py-2 rounded-md text-xs font-mono font-semibold transition-colors shrink-0 focus-visible:ring-1 focus-visible:ring-lime",
                activeTab === t.id
                  ? "bg-lime text-lime-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "checks" && (
            <div className="space-y-6">
              <CategoryFilters
                catFilter={catFilter}
                setCatFilter={setCatFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
              />

              {Object.keys(categoryGroups).length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No checks match the active filter criteria.
                </div>
              ) : (
                Object.entries(categoryGroups).map(([category, checks]) => (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border/60 pb-1.5">
                      <span className="font-bold text-foreground">{category}</span>
                      <span>{checks.length} check(s)</span>
                    </div>
                    <div className="space-y-2.5">
                      {checks.map((c) => (
                        <CheckCard key={c.id} check={c} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "fixes" && (
            <div>
              {report.fixes && report.fixes.length > 0 ? (
                <RecommendedFixes fixes={report.fixes} />
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground space-y-2">
                  <CheckCircle2 className="h-6 w-6 text-pass mx-auto" />
                  <p className="font-semibold text-foreground">No remediation required!</p>
                  <p className="text-xs">All checks completed without failing verdicts.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "manifest" && (
            <div>
              {report.probeManifest && report.probeManifest.length > 0 ? (
                <ManifestViewer manifest={report.probeManifest} />
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No probe manifest recorded.
                </div>
              )}
            </div>
          )}

          {activeTab === "raw" && (
            <details open className="group">
              <summary className="cursor-pointer font-mono text-xs text-muted-foreground hover:text-lime mb-2">
                Click to collapse/expand raw JSON payload
              </summary>
              <JsonViewer data={report} />
            </details>
          )}
        </div>
      </div>
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
    <div className="flex flex-wrap items-center justify-between gap-4 bg-background/50 p-3 rounded-xl border border-border">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mr-1">Status</span>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-2.5 py-1 rounded text-xs font-mono border transition-colors focus-visible:ring-1 focus-visible:ring-lime",
              statusFilter === s
                ? "border-lime bg-lime/10 text-lime font-bold"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mr-1">Category</span>
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCatFilter(c)}
            className={cn(
              "px-2.5 py-1 rounded text-xs font-mono border transition-colors focus-visible:ring-1 focus-visible:ring-lime",
              catFilter === c
                ? "border-lime bg-lime/10 text-lime font-bold"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
