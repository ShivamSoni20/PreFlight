import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight, Shield, Globe, Radio, Wrench, CheckCircle2,
  Lock, Wifi, Server, KeyRound, FileJson, Code2, Fingerprint,
  Boxes, Network, Database, Package, Cpu, Clock, Zap, Loader2, Sparkles, AlertCircle
} from "lucide-react";
import { Navigation, Footer, DisclaimerBanner } from "@/components/preflight/shell";
import { HeroScanner } from "@/components/preflight/hero-scanner";
import { ScoreGauge } from "@/components/preflight/audit-ui";
import type { AuditReport } from "@/lib/preflight-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Preflight — Test your agent service before the marketplace does" },
      { name: "description", content: "Preflight probes your public agent endpoint for network, protocol, and x402 payment behavior — returning readiness scores with evidence for every check." },
      { property: "og:title", content: "Preflight — Test your agent service before the marketplace does" },
      { property: "og:description", content: "Deterministic agent endpoint validation. 16 probes, live fixtures, and grounded remediation." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navigation />
      <Hero />
      <MagicMoment />
      <HowItWorks />
      <WhyItIsBetter />
      <ProofSection />
      <SecuritySection />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Hero Section
// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section className="relative overflow-hidden py-16 md:py-24 border-b border-border/60">
      <div className="absolute inset-0 grid-bg opacity-35 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-lime/5 to-transparent pointer-events-none" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 grid gap-12 lg:grid-cols-[1.1fr_1fr] items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-lime/40 bg-lime/10 px-3 py-1 text-xs font-mono uppercase tracking-widest text-lime">
            <span className="h-1.5 w-1.5 rounded-full bg-lime animate-blink" />
            FOR AGENT SERVICE PROVIDERS
          </div>

          <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Test your agent service before the marketplace does.
          </h1>

          <p className="mt-5 text-lg text-muted-foreground max-w-xl leading-relaxed">
            Paste your endpoint URL. Preflight probes its network, protocol, and x402 payment behavior — then hands you a readiness score with evidence for every check and a fix for every failure.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-md bg-lime px-6 py-3.5 text-sm font-semibold text-lime-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-lime focus-visible:outline-none transition-all shadow-[0_0_24px_rgba(163,255,79,0.25)]"
            >
              Run Free Preflight
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/dashboard"
              search={{ demo: "free" }}
              className="text-sm font-mono text-muted-foreground hover:text-lime underline-offset-4 hover:underline py-2 focus-visible:ring-2 focus-visible:ring-lime focus-visible:outline-none rounded px-2"
            >
              Try a live demo →
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs font-mono text-muted-foreground">
            {["16 deterministic checks", "Zero secrets stored", "No wallet required"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-lime" /> {t}
              </span>
            ))}
          </div>
        </div>

        <div className="relative w-full flex justify-center">
          <HeroScanner />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. Magic Moment: Real Interactive Strip (Input -> Action -> Outcome)
// ---------------------------------------------------------------------------

function MagicMoment() {
  const [url, setUrl] = useState("https://probe-kit-flax.vercel.app/api/demo/free");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAudit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUrl: url.trim(), method: "GET" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Audit request failed");
      setReport(data as AuditReport);
    } catch (err: any) {
      setError(err?.message || "Could not reach endpoint");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20 md:py-28 border-b border-border/60">
      <SectionHeader
        eyebrow="Magic moment"
        title="From URL to verdict in seconds."
      />

      <div className="mt-12 max-w-4xl mx-auto rounded-2xl border border-border bg-panel p-6 sm:p-8 shadow-xl">
        <form onSubmit={handleAudit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-service.example.com/api"
            className="flex-1 rounded-md border border-border bg-background px-4 py-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-lime px-6 py-3 text-sm font-semibold text-lime-foreground hover:opacity-90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-lime focus-visible:outline-none transition-all"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {loading ? "Probing…" : "Run preflight"}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-mono">
          <span>Preset fixtures:</span>
          {[
            { name: "Valid Free", path: "/api/demo/free" },
            { name: "Broken x402", path: "/api/demo/broken-x402" },
            { name: "Valid x402", path: "/api/demo/valid-x402" },
          ].map((f) => (
            <button
              key={f.name}
              type="button"
              onClick={() => {
                const fullUrl = new URL(f.path, window.location.origin).toString();
                setUrl(fullUrl);
              }}
              className="rounded-full border border-border px-2.5 py-1 hover:border-lime hover:text-lime transition-colors focus-visible:ring-1 focus-visible:ring-lime"
            >
              {f.name}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-coral/40 bg-coral/5 p-4 text-xs font-mono text-coral flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {report && (
          <div className="mt-8 rounded-xl border border-lime/30 bg-background/80 p-6 animate-fade-up">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="scale-90 sm:scale-100 origin-left">
                  <ScoreGauge score={report.score} readiness={report.readiness} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-mono uppercase tracking-wider text-lime">Readiness Verdict</div>
                  <div className="text-xl font-bold text-foreground">{report.readiness}</div>
                  <div className="text-xs font-mono text-muted-foreground">
                    {report.summary.passed} passed · {report.summary.warnings} warnings · {report.summary.failed} failed
                  </div>
                  <div className="text-[11px] font-mono text-cyan pt-1">
                    Latency: {report.durationMs}ms · {report.endpointType}
                  </div>
                </div>
              </div>

              <Link
                to="/dashboard"
                search={{ url: report.targetUrl }}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-4 py-2.5 text-xs font-semibold hover:border-lime hover:text-lime transition-colors"
              >
                Inspect full evidence in dashboard →
              </Link>
            </div>
          </div>
        )}

        {/* 3 mini cards: Input -> Action -> Outcome */}
        <div className="mt-8 pt-8 border-t border-border/80 grid md:grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-xl border border-border/60 bg-background/40">
            <div className="text-xs font-mono text-lime font-bold">01 · INPUT</div>
            <div className="font-semibold text-sm mt-1">Paste URL</div>
            <div className="text-xs text-muted-foreground mt-1">Any public HTTPS endpoint.</div>
          </div>
          <div className="p-4 rounded-xl border border-border/60 bg-background/40">
            <div className="text-xs font-mono text-lime font-bold">02 · PRODUCT ACTION</div>
            <div className="font-semibold text-sm mt-1">16 probes run</div>
            <div className="text-xs text-muted-foreground mt-1">DNS, TLS, HTTP, x402 & X Layer.</div>
          </div>
          <div className="p-4 rounded-xl border border-border/60 bg-background/40">
            <div className="text-xs font-mono text-lime font-bold">03 · OUTCOME</div>
            <div className="font-semibold text-sm mt-1">Score + evidence + fixes</div>
            <div className="text-xs text-muted-foreground mt-1">Concrete remediation for errors.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. How It Works (Exactly 3 steps)
// ---------------------------------------------------------------------------

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Submit your endpoint",
      body: "Any public HTTPS URL. No account, no wallet.",
      icon: <Globe className="h-5 w-5" />,
    },
    {
      n: "02",
      title: "Preflight probes it",
      body: "Network, protocol, and payment challenges — safely, from the outside, like a marketplace would.",
      icon: <Radio className="h-5 w-5" />,
    },
    {
      n: "03",
      title: "Fix what failed",
      body: "Every failure ships with evidence and a concrete fix.",
      icon: <Wrench className="h-5 w-5" />,
    },
  ];

  return (
    <section id="how" className="mx-auto max-w-7xl px-4 sm:px-6 py-20 md:py-28 border-b border-border/60">
      <SectionHeader eyebrow="How it works" title="Three steps between draft and marketplace." />
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {steps.map((s) => (
          <div key={s.n} className="rounded-2xl border border-border bg-panel p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-lime/15 text-lime border border-lime/30">
                  {s.icon}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{s.n}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Stack strip */}
      <div className="mt-10 rounded-xl border border-border bg-panel/60 p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <span className="text-muted-foreground">Deterministic pipeline engine:</span>
        <div className="flex flex-wrap items-center gap-2">
          {["validate_input", "→", "safety_gate", "→", "bounded_fetch", "→", "classify", "→", "remediate"].map((n, idx) => (
            <span
              key={idx}
              className={cn(
                n === "→" ? "text-muted-foreground" : "px-2 py-0.5 rounded bg-background border border-border text-foreground"
              )}
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4. Why It's Better: 3 Compact Proof Cards + Collapsible 16 Checks Table
// ---------------------------------------------------------------------------

function WhyItIsBetter() {
  const proofCards = [
    {
      title: "Catches what localhost hides",
      body: "Probes resolve DNS and validate from the public internet, catching unsafe destinations your dev machine never sees.",
      icon: <Shield className="h-5 w-5" />,
    },
    {
      title: "Speaks x402 fluently",
      body: "Decodes PAYMENT-REQUIRED challenges and validates every field: version, resource, network, asset, amount, timeout.",
      icon: <KeyRound className="h-5 w-5" />,
    },
    {
      title: "Every verdict shows its work",
      body: "Evidence for each check, a manifest of everything probed, and fixes grounded in real failure patterns.",
      icon: <Sparkles className="h-5 w-5" />,
    },
  ];

  const fullChecks = [
    { icon: <Lock />, name: "Public HTTPS", cat: "Connectivity", desc: "TLS-secured public endpoint." },
    { icon: <Shield />, name: "Safe public hostname", cat: "Connectivity", desc: "Blocks private and local ranges." },
    { icon: <Wifi />, name: "Endpoint reachability", cat: "Connectivity", desc: "Network connectivity from a public probe." },
    { icon: <Server />, name: "HTTP 200 behavior", cat: "HTTP", desc: "Free endpoints return success." },
    { icon: <KeyRound />, name: "HTTP 402 behavior", cat: "x402", desc: "Paid endpoints return a challenge." },
    { icon: <FileJson />, name: "JSON response", cat: "HTTP", desc: "Parseable JSON body." },
    { icon: <Radio />, name: "PAYMENT-REQUIRED", cat: "x402", desc: "Challenge header present." },
    { icon: <Code2 />, name: "Base64 decoding", cat: "x402", desc: "Challenge decodes cleanly." },
    { icon: <Fingerprint />, name: "x402 version", cat: "x402", desc: "Protocol version declared." },
    { icon: <Boxes />, name: "Resource metadata", cat: "x402", desc: "Resource identifier present." },
    { icon: <Network />, name: "X Layer network", cat: "X Layer", desc: "Chain identifier is X Layer." },
    { icon: <Database />, name: "Asset address", cat: "X Layer", desc: "Well-formed ERC-20 asset." },
    { icon: <Package />, name: "Recipient address", cat: "X Layer", desc: "Valid recipient address." },
    { icon: <Cpu />, name: "Amount", cat: "X Layer", desc: "Numeric amount declared." },
    { icon: <Clock />, name: "Timeout", cat: "X Layer", desc: "Sensible request timeout." },
    { icon: <Zap />, name: "Response latency", cat: "Connectivity", desc: "Fast enough for review." },
  ];

  return (
    <section id="checks" className="mx-auto max-w-7xl px-4 sm:px-6 py-20 md:py-28 border-b border-border/60">
      <SectionHeader eyebrow="Why it's better" title="Engineered for agent economy readiness." />

      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {proofCards.map((c) => (
          <div key={c.title} className="rounded-2xl border border-border bg-panel p-6">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-lime/15 text-lime border border-lime/30">
              {c.icon}
            </span>
            <h3 className="mt-5 text-lg font-semibold">{c.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <details className="group rounded-2xl border border-border bg-panel/40 p-5">
          <summary className="cursor-pointer list-none flex items-center justify-between font-mono text-sm font-semibold">
            <span>View all 16 deterministic checks</span>
            <span className="text-lime group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-6 pt-6 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-3">
            {fullChecks.map((c) => (
              <div key={c.name} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-2 text-lime [&_svg]:h-4 [&_svg]:w-4">
                  {c.icon}
                  <span className="font-semibold text-xs text-foreground truncate">{c.name}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 truncate">{c.desc}</div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 5. Proof / Trust: 3 Demo Fixture Cards + Deterministic Invariant
// ---------------------------------------------------------------------------

function ProofSection() {
  const demos = [
    {
      title: "Valid Free Endpoint",
      endpoint: "GET /api/demo/free",
      desc: "Returns HTTP 200 with structured JSON response without requiring payment.",
      key: "free",
    },
    {
      title: "Broken x402 Endpoint",
      endpoint: "GET /api/demo/broken-x402",
      desc: "Returns HTTP 402 but deliberately omits PAYMENT-REQUIRED header.",
      key: "broken",
    },
    {
      title: "Valid x402 Challenge",
      endpoint: "GET /api/demo/valid-x402",
      desc: "Returns HTTP 402 with full base64 challenge targeting OKX X Layer eip155:196.",
      key: "valid",
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20 md:py-28 border-b border-border/60">
      <SectionHeader eyebrow="Trust & validation" title="Test with deterministic fixtures." />
      <p className="mt-3 text-center text-sm font-mono text-muted-foreground">
        Deterministic — the same URL always produces the same report.
      </p>

      <div className="mt-10 grid md:grid-cols-3 gap-6">
        {demos.map((d) => (
          <div key={d.key} className="rounded-2xl border border-border bg-panel p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-lime">Demo Fixture</div>
              <h3 className="mt-2 text-lg font-semibold">{d.title}</h3>
              <div className="mt-1 font-mono text-xs text-cyan truncate">{d.endpoint}</div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{d.desc}</p>
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <Link
                to="/dashboard"
                search={{ demo: d.key as "free" | "broken" | "valid" }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-xs font-semibold hover:border-lime hover:text-lime transition-colors"
              >
                Try this demo →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 6. Security Section (Condensed to 6 bullets max)
// ---------------------------------------------------------------------------

function SecuritySection() {
  const items = [
    "HTTPS-only requests with valid TLS certificates",
    "Private, local, link-local and cloud metadata IP blocking",
    "Pre-flight DoH resolution to eliminate SSRF attack vectors",
    "Strict 5-second execution timeout on every network hop",
    "256 KB response body cap protecting against memory exhaustion",
    "Zero secrets, keys, or wallets stored or requested",
  ];

  return (
    <section id="security" className="mx-auto max-w-7xl px-4 sm:px-6 py-20 md:py-28 border-b border-border/60">
      <div className="rounded-3xl border border-border bg-panel/60 p-8 md:p-12">
        <div className="grid md:grid-cols-[1fr_1.2fr] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-xs font-mono uppercase tracking-widest text-cyan">
              <Shield className="h-3.5 w-3.5" /> Security
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
              A scanner should never become an attack surface.
            </h2>
            <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
              Preflight runs deterministic, read-only checks with strict egress hygiene. Untrusted URLs cannot traverse internal networks.
            </p>
          </div>

          <ul className="grid sm:grid-cols-2 gap-3">
            {items.map((t) => (
              <li key={t} className="flex items-start gap-2.5 rounded-lg border border-border bg-background p-3 text-xs">
                <CheckCircle2 className="h-4 w-4 text-lime shrink-0 mt-0.5" />
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 7. FAQ (4-5 honest items)
// ---------------------------------------------------------------------------

function Faq() {
  const faqs = [
    {
      q: "Does passing Preflight guarantee marketplace approval?",
      a: "No. Preflight is an independent technical validation tool. Passing its checks confirms your endpoint complies with networking, protocol, and x402 standards, but does not constitute official endorsement or guarantee listing.",
    },
    {
      q: "Does Preflight make or settle payments on-chain?",
      a: "No. Preflight inspects and decodes the structural validity of HTTP 402 PAYMENT-REQUIRED challenges. It never signs transactions, touches a private key, or submits settlement funds.",
    },
    {
      q: "Can I test free endpoints?",
      a: "Yes. Endpoints that directly return HTTP 200 with structured JSON payloads are evaluated as Free A2MCP services.",
    },
    {
      q: "Do I need an account or API key?",
      a: "No account, wallet, or payment is required to run preflight audits.",
    },
  ];

  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 py-20 md:py-28 border-b border-border/60">
      <SectionHeader eyebrow="FAQ" title="Straight answers." />
      <div className="mt-12 divide-y divide-border border-y border-border">
        {faqs.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
              <span className="font-semibold text-sm sm:text-base">{f.q}</span>
              <span className="grid h-7 w-7 place-items-center rounded-full border border-border group-open:bg-lime group-open:text-lime-foreground group-open:border-lime transition-colors">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-8">
        <DisclaimerBanner />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 8. Final CTA (One clear promise, one button)
// ---------------------------------------------------------------------------

function FinalCta() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20 md:py-28">
      <div className="relative overflow-hidden rounded-3xl border border-lime/30 bg-gradient-to-br from-panel to-background p-10 md:p-16 text-center">
        <div className="absolute inset-0 grid-bg opacity-35 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="relative">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Don't let a broken header block a great service.
          </h2>
          <p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto">
            Test your agent service before the marketplace does.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-md bg-lime px-8 py-4 text-sm font-semibold text-lime-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-lime focus-visible:outline-none transition-all shadow-[0_0_24px_rgba(163,255,79,0.3)] animate-pulse-ring"
            >
              Run Free Preflight
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-4 text-xs font-mono text-muted-foreground">No login. No wallet. No secrets.</p>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, align = "center" }: { eyebrow: string; title: string; align?: "center" | "left" }) {
  return (
    <div className={cn(align === "center" && "text-center", "max-w-3xl", align === "center" && "mx-auto")}>
      <div className="text-xs font-mono uppercase tracking-widest text-lime">{eyebrow}</div>
      <h2 className="mt-3 text-3xl md:text-5xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}
