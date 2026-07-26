import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, Github, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProbeLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <circle cx="16" cy="16" r="3" fill="var(--lime)" className="animate-blink" />
      <path d="M16 2v6M16 24v6M2 16h6M24 16h6" stroke="var(--lime)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { href: "#how", label: "How it works" },
    { href: "#checks", label: "Checks" },
    { href: "#security", label: "Security" },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-transparent transition-all",
        scrolled ? "border-border bg-background/85 backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div className={cn("mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 transition-all", scrolled ? "h-14" : "h-16")}>
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-panel border border-border text-lime">
            <ProbeLogo />
          </span>
          <span className="flex items-center gap-2 min-w-0">
            <span className="font-semibold tracking-tight truncate">ASP ProbeKit</span>
            <span className="hidden sm:inline-flex items-center rounded-full border border-lime/40 bg-lime/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-lime">
              Genesis Build
            </span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          {navLinks.map(l => (
            <a key={l.href} href={l.href} className="hover:text-foreground transition-colors">{l.label}</a>
          ))}
          <a href="https://github.com" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
            <Github className="h-4 w-4" /> GitHub
          </a>
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link to="/dashboard" search={{ demo: "free" }} className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">
            View Demo
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-md bg-lime px-4 py-2 text-sm font-semibold text-lime-foreground hover:opacity-90 transition-opacity"
          >
            Run Free Preflight
          </Link>
        </div>

        <button
          className="md:hidden grid h-10 w-10 place-items-center rounded-md border border-border"
          onClick={() => setOpen(v => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="px-4 py-4 flex flex-col gap-3">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-2 text-foreground">{l.label}</a>
            ))}
            <a href="https://github.com" target="_blank" rel="noreferrer" className="py-2 flex items-center gap-2">
              <Github className="h-4 w-4" /> GitHub <ExternalLink className="h-3 w-3" />
            </a>
            <Link
              to="/dashboard"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-lime px-4 py-3 text-sm font-semibold text-lime-foreground"
            >
              Run Free Preflight
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-panel/40 mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 text-lime">
            <ProbeLogo />
            <span className="font-semibold text-foreground">ASP ProbeKit</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground max-w-xs">
            A protocol preflight lab for agent services. Test before you list.
          </p>
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Product</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/dashboard" className="hover:text-lime">Dashboard</Link></li>
            <li><a href="#how" className="hover:text-lime">How it works</a></li>
            <li><a href="#checks" className="hover:text-lime">Checks</a></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Resources</div>
          <ul className="space-y-2 text-sm">
            <li><a href="https://github.com" className="hover:text-lime">GitHub</a></li>
            <li><a href="#" className="hover:text-lime">Documentation</a></li>
            <li><a href="#security" className="hover:text-lime">Security</a></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">About</div>
          <p className="text-sm text-muted-foreground">
            Built for OKX.AI Genesis. Independent tool — not officially certified or endorsed by OKX.
          </p>
          <p className="mt-3 text-xs font-mono text-lime">#OKXAI</p>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-2 justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} ASP ProbeKit</span>
          <span>No secrets stored. No accounts. HTTPS-only requests.</span>
        </div>
      </div>
    </footer>
  );
}

export function DisclaimerBanner() {
  return (
    <div className="rounded-lg border border-amber/30 bg-amber/5 px-4 py-3 text-xs text-amber flex items-start gap-2">
      <span className="font-mono uppercase tracking-wider text-[10px] rounded bg-amber/20 px-1.5 py-0.5">Note</span>
      <span>
        ASP ProbeKit is an independent preflight tool. Passing these checks does not guarantee marketplace approval.
      </span>
    </div>
  );
}
