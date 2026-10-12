import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight, Zap, Shield, Terminal, Wifi, Lock, Radio, Boxes,
  CheckCircle2, AlertTriangle, XCircle, Globe, Server, KeyRound,
  Clock, Cpu, Network, Code2, FileJson, Fingerprint, Database,
  Wrench, Search, Package,
} from "lucide-react";
import { Navigation, Footer, DisclaimerBanner } from "@/components/preflight/shell";
import { HeroScanner } from "@/components/preflight/hero-scanner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Preflight — Ship your agent service with confidence" },
      { name: "description", content: "Preflight validator for free and x402-powered A2MCP endpoints. Catch endpoint, HTTP and x402 compatibility problems before your service reaches marketplace review." },
      { property: "og:title", content: "Preflight — Test before you list" },
      { property: "og:description", content: "A protocol preflight lab for agent services. Deterministic checks, no login, no secrets." },
    ],
  }),
  component: LandingPage,
});

const DEMO_URLS = [
  { label: "Valid free endpoint", url: "/api/demo/free", kind: "free" as const },
  { label: "Broken x402 endpoint", url: "/api/demo/broken-x402", kind: "broken" as const },
  { label: "Valid x402 structure", url: "/api/demo/valid-x402", kind: "valid" as const },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <Hero />
      <MiniAudit />
      <Problems />
      <HowItWorks />
      <ProtocolCoverage />
      <ExampleReport />
      <SecuritySection />
      <BuiltForAgents />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-lime/5 to-transparent pointer-events-none" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 md:py-24 grid gap-12 lg:grid-cols-[1.05fr_1fr] items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-lime animate-blink" />
            A protocol preflight lab for agent services
          </div>
          <h1 className="mt-6 text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.02]">
            Ship your ASP
            <br />
            with <span className="text-lime text-glow-lime italic">confidence.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
            LangGraph-orchestrated preflight scanner for agent services. Catch HTTP, protocol, and x402 compatibility problems with RAG-grounded fixes and validated probe provenance.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-2 rounded-md bg-lime px-5 py-3 text-sm font-semibold text-lime-foreground hover:opacity-90"
            >
              Run Free Preflight
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/dashboard"
              search={{ demo: "free" }}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-5 py-3 text-sm font-semibold hover:border-lime"
            >
              Test a Demo Endpoint
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs font-mono text-muted-foreground">
            {["Deterministic checks", "No login required", "No secrets requested", "Free A2MCP utility"].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-lime" /> {t}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <HeroScanner />
        </div>
      </div>
    </section>
  );
}

function MiniAudit() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("GET");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    navigate({ to: "/dashboard", search: { url: url.trim(), method } });
  };

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 -mt-4 md:-mt-12">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-border bg-panel p-4 md:p-5 shadow-xl"
      >
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          <Terminal className="h-3.5 w-3.5 text-lime" /> Live mini audit
        </div>
        <div className="grid md:grid-cols-[auto_1fr_auto] gap-2">
          <div className="inline-flex rounded-md border border-border bg-background p-0.5">
            {(["GET", "POST"] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cn(
                  "px-3 py-2 rounded text-xs font-mono font-semibold transition-colors",
                  method === m ? "bg-lime text-lime-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >{m}</button>
            ))}
          </div>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://your-service.example/api"
            className="min-w-0 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:border-lime"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-lime px-5 py-2 text-sm font-semibold text-lime-foreground hover:opacity-90"
          >
            <Zap className="h-4 w-4" /> Run
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground mr-1 self-center">Try:</span>
          {DEMO_URLS.map(d => (
            <button
              key={d.url}
              type="button"
              onClick={() => setUrl(new URL(d.url, window.location.origin).toString())}
              className="text-xs font-mono px-2.5 py-1 rounded-full border border-border hover:border-lime hover:text-lime transition-colors"
            >
              {d.label}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}

function Problems() {
  const items = [
    {
      icon: <Network className="h-5 w-5" />,
      title: "Endpoint mismatch",
      body: "Your service works locally but is unreachable from the marketplace.",
      art: <PacketArt kind="fail" />,
    },
    {
      icon: <KeyRound className="h-5 w-5" />,
      title: "Payment challenge failure",
      body: "HTTP 402 is returned, but the challenge cannot be decoded or validated.",
      art: <PacketArt kind="warn" />,
    },
    {
      icon: <Wrench className="h-5 w-5" />,
      title: "Unclear remediation",
      body: "You know the endpoint failed, but not which field needs to change.",
      art: <PacketArt kind="info" />,
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-24">
      <SectionHeader eyebrow="Problem" title="One broken header can block a great service." />
      <div className="mt-12 grid md:grid-cols-3 gap-4">
        {items.map(it => (
          <div key={it.title} className="rounded-2xl border border-border bg-panel p-6 hover:border-lime/40 transition-colors">
            <div className="h-32 rounded-lg border border-border bg-background overflow-hidden mb-5">{it.art}</div>
            <div className="flex items-center gap-2 text-lime">{it.icon}<span className="text-xs font-mono uppercase tracking-widest">Symptom</span></div>
            <h3 className="mt-2 text-lg font-semibold">{it.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PacketArt({ kind }: { kind: "fail" | "warn" | "info" }) {
  const color = kind === "fail" ? "var(--coral)" : kind === "warn" ? "var(--amber)" : "var(--cyan)";
  return (
    <svg viewBox="0 0 300 130" className="w-full h-full">
      <defs>
        <pattern id={`g-${kind}`} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16 0H0V16" fill="none" stroke="var(--grid)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="300" height="130" fill={`url(#g-${kind})`} opacity="0.5" />
      <line x1="20" y1="65" x2="280" y2="65" stroke="var(--border)" strokeDasharray="4 4" />
      <circle cx="20" cy="65" r="6" fill="var(--lime)" />
      <circle cx="280" cy="65" r="6" fill={color} />
      {[60, 110, 160, 210].map((x, i) => (
        <rect key={i} x={x} y="58" width="14" height="14" fill={i < 2 ? "var(--pass)" : color} opacity={i < 2 ? 1 : 0.85} rx="2">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="1.8s" repeatCount="indefinite" begin={`${i * 0.2}s`} />
        </rect>
      ))}
      <text x="20" y="95" fontFamily="ui-monospace" fontSize="9" fill="var(--muted-foreground)">client</text>
      <text x="252" y="95" fontFamily="ui-monospace" fontSize="9" fill={color}>service</text>
    </svg>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Paste your endpoint", body: "Provide a public HTTPS API and choose GET or POST.", icon: <Globe className="h-5 w-5" /> },
    { n: "02", title: "Run the protocol scan", body: "Preflight inspects connectivity, HTTP behavior, JSON and x402 structure.", icon: <Radio className="h-5 w-5" /> },
    { n: "03", title: "Fix and rerun", body: "Receive exact evidence and remediation for every failed check.", icon: <Wrench className="h-5 w-5" /> },
  ];
  return (
    <section id="how" className="mx-auto max-w-7xl px-4 sm:px-6 py-24">
      <SectionHeader eyebrow="How it works" title="Three steps between draft and marketplace." />
      <div className="relative mt-14">
        <div className="hidden md:block absolute top-16 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime/40 to-transparent" />
        <div className="hidden md:block absolute top-16 left-0 right-0 pointer-events-none">
          <div className="h-1.5 w-1.5 rounded-full bg-lime animate-packet" style={{ position: "relative" }} />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {steps.map(s => (
            <div key={s.n} className="rounded-2xl border border-border bg-panel p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-lime/15 text-lime border border-lime/30">
                  {s.icon}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{s.n}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Agentic pipeline LangGraph flow strip */}
        <div className="mt-8 rounded-2xl border border-border bg-panel/60 p-6 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-lime">LangGraph Engine</div>
              <h4 className="text-sm font-semibold text-foreground mt-0.5">Deterministic Orchestration with RAG Grounding</h4>
            </div>
            <span className="text-xs font-mono text-muted-foreground rounded-full border border-border px-3 py-1 bg-background">
              AI reasons · Code decides
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-mono">
            {[
              "validate_input",
              "→",
              "safety_gate",
              "→",
              "fetch (bounded)",
              "→",
              "classify (200 / 402 / error)",
              "→",
              "aggregate",
              "→",
              "remediate (RAG + LLM)",
            ].map((node, i) => (
              <span
                key={i}
                className={cn(
                  node === "→"
                    ? "text-muted-foreground"
                    : node.includes("remediate")
                    ? "rounded border border-lime/40 bg-lime/10 px-2 py-1 text-lime font-semibold"
                    : "rounded border border-border bg-background px-2 py-1 text-foreground"
                )}
              >
                {node}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProtocolCoverage() {
  const checks = [
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
    <section id="checks" className="mx-auto max-w-7xl px-4 sm:px-6 py-24">
      <SectionHeader eyebrow="Protocol coverage" title="Sixteen deterministic checks. Zero guessing." />
      <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {checks.map(c => (
          <div key={c.name} className="group rounded-xl border border-border bg-panel p-4 hover:border-lime/50 hover:bg-panel-2 transition-colors">
            <div className="flex items-start justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-background border border-border text-lime [&_svg]:h-4 [&_svg]:w-4">
                {c.icon}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground rounded border border-border px-1.5 py-0.5">
                {c.cat}
              </span>
            </div>
            <div className="mt-3 font-semibold text-sm">{c.name}</div>
            <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{c.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExampleReport() {
  const [fixed, setFixed] = useState(false);
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-24">
      <SectionHeader eyebrow="Example audit report" title="Every failure explains itself." />
      <div className="mt-12 grid lg:grid-cols-[1.1fr_1fr] gap-6 items-start">
        <div className="rounded-2xl border border-border bg-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Audit complete</div>
              <div className="text-lg font-semibold mt-0.5">api.example.com</div>
            </div>
            <button
              onClick={() => setFixed(f => !f)}
              className="text-xs font-mono px-3 py-1.5 rounded border border-lime/40 bg-lime/10 text-lime hover:bg-lime/20"
            >
              {fixed ? "Show broken" : "Simulate fix"}
            </button>
          </div>
          <div className="p-6 grid grid-cols-[auto_1fr] gap-6 items-center">
            <div className="relative">
              <svg width="140" height="140" viewBox="0 0 160 160" className="-rotate-90">
                <circle cx="80" cy="80" r="70" stroke="var(--panel-2)" strokeWidth="10" fill="none" />
                <circle cx="80" cy="80" r="70" stroke={fixed ? "var(--pass)" : "var(--amber)"} strokeWidth="10" fill="none"
                  strokeLinecap="round" strokeDasharray={2 * Math.PI * 70}
                  strokeDashoffset={2 * Math.PI * 70 * (1 - (fixed ? 0.94 : 0.82))}
                  style={{ transition: "stroke-dashoffset 700ms ease-out, stroke 700ms" }}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="font-mono text-4xl font-bold tabular-nums" style={{ color: fixed ? "var(--pass)" : "var(--amber)" }}>
                    {fixed ? 94 : 82}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">/ 100</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                {fixed ? "Protocol ready" : "Almost ready"}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Chip color="pass">{fixed ? 11 : 8} passed</Chip>
                <Chip color="amber">{fixed ? 0 : 2} warnings</Chip>
                <Chip color="coral">{fixed ? 0 : 1} failed</Chip>
              </div>
            </div>
          </div>
        </div>

        <div className={cn(
          "rounded-2xl border p-5 transition-colors",
          fixed ? "border-pass/40 bg-pass/5" : "border-coral/40 bg-coral/5"
        )}>
          <div className="flex items-center gap-2">
            {fixed ? <CheckCircle2 className="h-5 w-5 text-pass" /> : <XCircle className="h-5 w-5 text-coral" />}
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Check</span>
          </div>
          <h3 className="mt-2 font-semibold text-lg">PAYMENT-REQUIRED header</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {fixed
              ? "Endpoint returned HTTP 402 with a valid base64 x402 v2 challenge in the PAYMENT-REQUIRED header."
              : "The endpoint returned HTTP 402, but the payment challenge was not present in the expected header."}
          </p>
          {!fixed && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-lime/30 bg-lime/5 p-3">
              <ArrowRight className="h-4 w-4 text-lime mt-0.5" />
              <div>
                <div className="text-xs uppercase font-mono tracking-widest text-lime">Recommended fix</div>
                <div className="mt-1 text-sm">Base64-encode the x402 v2 challenge and return it in the PAYMENT-REQUIRED response header.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Chip({ color, children }: { color: "pass" | "amber" | "coral"; children: React.ReactNode }) {
  const map = {
    pass: "bg-pass/10 border-pass/30 text-pass",
    amber: "bg-amber/10 border-amber/30 text-amber",
    coral: "bg-coral/10 border-coral/30 text-coral",
  };
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono", map[color])}>{children}</span>;
}

function SecuritySection() {
  const items = [
    "HTTPS-only requests", "Private-network blocking", "Redirect validation",
    "Strict timeout", "Response-size limits", "No secret forwarding",
    "No remote HTML execution", "No authentication required",
  ];
  return (
    <section id="security" className="mx-auto max-w-7xl px-4 sm:px-6 py-24">
      <div className="rounded-3xl border border-border bg-panel/60 p-8 md:p-12">
        <div className="grid md:grid-cols-[1fr_1.2fr] gap-10 items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-xs font-mono uppercase tracking-widest text-cyan">
              <Shield className="h-3.5 w-3.5" /> Security
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
              A scanner should never become an attack surface.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-md">
              Preflight runs deterministic, read-only checks with strict egress hygiene. Nothing is stored, nothing is executed.
            </p>
          </div>
          <ul className="grid sm:grid-cols-2 gap-2">
            {items.map(t => (
              <li key={t} className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-lime shrink-0" />
                <span className="text-sm">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function BuiltForAgents() {
  const uses = [
    { icon: <Database />, label: "Data APIs" },
    { icon: <Cpu />, label: "Software utilities" },
    { icon: <Search />, label: "Research tools" },
    { icon: <Shield />, label: "Validation services" },
    { icon: <KeyRound />, label: "Paid x402 endpoints" },
    { icon: <Radio />, label: "Free A2MCP endpoints" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-24">
      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 items-center">
        <div>
          <SectionHeader eyebrow="Built for agent services" title="Standardized. Machine-callable. Predictable." align="left" />
          <p className="mt-6 text-muted-foreground max-w-lg">
            Preflight is designed for standardized machine-callable services that take parameters and return clear results.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {uses.map(u => (
            <div key={u.label} className="rounded-xl border border-border bg-panel p-4 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-background border border-border text-lime [&_svg]:h-4 [&_svg]:w-4">
                {u.icon}
              </span>
              <span className="text-sm font-medium">{u.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    { q: "Is Preflight an official OKX certification?", a: "No. Preflight is an independent technical preflight tool. Passing its checks does not guarantee marketplace approval." },
    { q: "Does Preflight make payments?", a: "The MVP validates x402 challenge structure but does not submit or settle payments." },
    { q: "Does it support free endpoints?", a: "Yes. Free endpoints that return their result directly with HTTP 200 can be audited." },
    { q: "Do I need an account?", a: "No account is required for the MVP." },
    { q: "Are my secrets required?", a: "No. Do not submit API keys, authorization headers or payment credentials." },
  ];
  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 py-24">
      <SectionHeader eyebrow="FAQ" title="Straight answers." />
      <div className="mt-12 divide-y divide-border border-y border-border">
        {faqs.map(f => (
          <details key={f.q} className="group py-5">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
              <span className="font-semibold">{f.q}</span>
              <span className="grid h-7 w-7 place-items-center rounded-full border border-border group-open:bg-lime group-open:text-lime-foreground group-open:border-lime transition-colors">+</span>
            </summary>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-8"><DisclaimerBanner /></div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 sm:px-6 py-24">
      <div className="relative overflow-hidden rounded-3xl border border-lime/30 bg-gradient-to-br from-panel to-background p-10 md:p-16 text-center">
        <div className="absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="relative">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight">
            Find the failure <span className="text-lime text-glow-lime">before review does.</span>
          </h2>
          <div className="mt-8 flex justify-center">
            <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-md bg-lime px-6 py-3.5 text-sm font-semibold text-lime-foreground hover:opacity-90 animate-pulse-ring">
              Run Free Preflight
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground font-mono">No login. No wallet. No secrets.</p>
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
