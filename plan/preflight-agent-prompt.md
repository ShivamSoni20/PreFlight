# Agent Prompt — ProbeKit → Preflight: rename + agentic upgrade

Copy everything below the line into your coding agent. The repo is
https://github.com/ShivamSoni20/ProbeKit (TanStack Start + Nitro, TypeScript,
Tailwind v4, Zod, **Bun** — use `bun add` / `bun run`, never npm).

Do the tasks in order: 1 (rename) → 2 (harness) → 3 (LangGraph) → 4 (RAG) →
5 (LangChain remediation) → 6 (evals) → Verification.

---

## Task 1 — Rename ProbeKit → Preflight

New brand: **Preflight**. Tagline: "Test your agent service before the marketplace
does." The radar/target logo (ProbeLogo) already fits — keep the SVG, rename the
component.

Apply these exact case-sensitive replacements (in this order). **Exception:** do NOT
touch `probe-kit-flax.vercel.app` (the live deployment URL) — it stays until the
Vercel redeploy, which is a manual step outside this task.

1. `ASP ProbeKit` → `Preflight` (all UI copy, meta, disclaimers, README handled separately)
2. `ASP-ProbeKit/1.0 (+preflight)` → `Preflight/2.0` (user-agent in `src/routes/api/audit.ts`)
3. `probekit://scan/` → `preflight://scan/` (hero-scanner terminal)
4. `ProbeKit` → `Preflight`
5. `probekit` → `preflight` (import paths, dirs)
6. `ProbeLogo` → `PreflightLogo` (component name + all usages)
7. `git mv src/lib/probekit-types.ts src/lib/preflight-types.ts`
8. `git mv src/components/probekit src/components/preflight` (then fix imports in
   `src/routes/dashboard.tsx`, `src/routes/index.tsx`)
9. `package.json`: `"name": "tanstack_start_ts"` → `"name": "preflight"`
10. `src/routes/api/health.ts`: `service: "Preflight"`, `version: "2.0.0"`
11. `src/routes/__root.tsx`: title/meta → "Preflight — Ship your agent service with confidence"
12. `src/routes/api/audit.ts`: GET-405 message → "Preflight audits endpoints through POST /api/audit.";
    disclaimer → "Preflight evaluates documented protocol behavior and independent readiness checks. A passing result does not guarantee marketplace approval."
13. `src/routes/dashboard.tsx`: meta titles/descriptions → Preflight wording
14. `src/components/preflight/shell.tsx`: nav wordmark, footer, `DisclaimerBanner`
    ("Preflight is an independent preflight tool…"), GitHub links
    `github.com/ShivamSoni20/ProbeKit` → `github.com/ShivamSoni20/Preflight`,
    `© … Preflight`
15. `src/routes/index.tsx`: all 10 occurrences (hero, sections, FAQ, final CTA)

Files NOT to touch for the rename: `src/components/ui/*` (boilerplate),
`src/routeTree.gen.ts` (regenerates), `bun.lock`, `assets.png` (regenerate manually
later — note it in your summary).

Done-when: `git grep -nE "ProbeKit|probekit" -- . ':!bun.lock'` returns zero matches
(excluding the protected `probe-kit-flax.vercel.app` URL), and `bunx tsc --noEmit`
passes.

## Task 2 — Agent harness: probes as validated tools

- `src/lib/harness/tools.ts`: a Zod-validated tool registry. Port the existing
  probe primitives out of `src/routes/api/audit.ts` into tools:
  `resolve_dns` (DoH + private-IP block), `bounded_fetch` (redirect revalidation,
  5s timeout, 256 KB cap), `inspect_x402` (header → base64 → JSON → field validation).
  Each tool declares `{ name, description, schema, timeoutMs, byteBudget,
  sideEffectClass: "network-read-only" }`.
- Execution wrapper `runTool(name, args)`: validates args against the Zod schema,
  enforces timeout/budget (kill + log on breach, never silent), supports
  `dryRun: true` (returns what *would* run without network I/O), and appends to an
  append-only probe log.
- Extend `AuditReport` in `src/lib/preflight-types.ts` with
  `probeManifest: { tool: string; durationMs: number; startedAt: string }[]`.
- Dashboard: render the manifest as an expandable "What was checked" section
  (reuse `CheckCard` styling from `src/components/preflight/audit-ui.tsx`).
- Keep every existing safety invariant (HTTPS-only, private-IP blocking, redirect
  revalidation, size limits) — they move into the tools, none are dropped.
- Acceptance: all network I/O in an audit flows through `runTool`; budget breach is
  logged visibly in the report.

## Task 3 — LangGraph audit pipeline

- `bun add @langchain/langgraph @langchain/core`
- `src/lib/preflight-graph.ts`: build a `StateGraph` over:
  ```ts
  type PreflightState = {
    targetUrl: string; method: "GET" | "POST"; requestBody?: unknown;
    checks: AuditCheck[]; endpointType: EndpointType;
    httpStatus: number | null; responseTimeMs?: number;
    score: number; readiness: Readiness; fixes: Remediation[];
    probeManifest: ProbeManifestEntry[]; auditId: string; startedAt: string;
  };
  ```
  Nodes — `validate_input` → `safety_gate` → `fetch` → `classify` →
  branch on status (`free_checks` | `x402_checks` | `http_failure`) →
  `aggregate` → `remediate` → END.
- Move the existing check functions from `src/routes/api/audit.ts` into the nodes
  **verbatim** (same logic, same messages) — no behavior change. Only `remediate`
  uses the LLM (Task 5); every other node is deterministic.
- Each node records its duration into `probeManifest`.
- Rewrite `src/routes/api/audit.ts` as a thin handler: Zod-parse request →
  `graph.invoke()` → return the report JSON. The POST contract is unchanged.
- Add `Remediation` + manifest types to `src/lib/preflight-types.ts`:
  ```ts
  export interface Remediation { checkId: string; fix: string; confidence: "high" | "medium" | "low"; sources: string[]; }
  ```
- Acceptance: run the 3 demo fixtures (`/api/demo/free`, `/broken-x402`,
  `/valid-x402`) before and after — reports must be identical except `fixes`,
  `probeManifest`, and timestamps.

## Task 4 — RAG remediation knowledge base (zero new infra)

- `src/lib/remediation-kb.json`: ~25 curated entries
  `{ signature: string; failurePattern: string; fix: string; source: string }`
  seeded from the existing `fix:` strings in the audit engine plus common
  x402/A2MCP misconfigurations (missing PAYMENT-REQUIRED, wrong network id,
  malformed asset address, non-JSON body, redirect chains…).
- `scripts/rag-ingest.ts` + `bun run rag:ingest` script: embeds each signature
  with the free-tier embedding model → writes `src/lib/remediation-kb.vectors.json`.
  Commit the vectors file so Vercel needs no ingest step.
- `src/lib/rag-retriever.ts`: `retrieveFixes(failedChecks: AuditCheck[], k=3)` —
  embed the check id+message, cosine search, similarity threshold 0.55, return
  `{ fix, source }[]`.
- `.env.example` (new file):
  ```
  AI_API_KEY=
  AI_API_BASE_URL=https://openrouter.ai/api/v1
  AI_MODEL=
  EMBEDDING_MODEL=
  ```
- Acceptance: every failed check across the 3 demo fixtures retrieves ≥1 relevant
  fix; below-threshold results are dropped, never shown.

## Task 5 — LangChain structured remediation (the one LLM node)

- `src/lib/ai.ts`: OpenAI-compatible client (baseURL + apiKey from env), mirroring
  the standard `getAiClient()` pattern. Zero-cost: OpenRouter free-tier model only.
- `remediate` node: for each failed check → `retrieveFixes()` → LangChain
  `withStructuredOutput` with Zod schema
  `{ checkId: z.string(), fix: z.string(), confidence: z.enum(["high","medium","low"]), sources: z.string().array() }`,
  temperature 0.2, system prompt: "Rewrite the retrieved fix as one concrete,
  copy-pasteable remediation step. Cite sources. Never invent endpoints, headers,
  or spec fields not present in the retrieved evidence."
- **Fallback:** on any LLM/embedding failure, use the existing static `fix:`
  strings with `confidence: "high", sources: ["built-in checks"]`. Remediation
  degrades; the audit never fails.
- Dashboard: "Recommended fixes" section per failed check with source citations.
- Acceptance: fixes cite KB sources; with `AI_API_KEY` unset, reports still complete
  using static fixes.

## Task 6 — Eval harness + CI

- `scripts/eval/run.ts` + `bun run eval`: golden set —
  (a) the 3 demo fixtures with expected check outcomes and score bands,
  (b) synthetic cases: private-IP target (must fail safely, no request sent),
  malformed x402 challenge, non-JSON 200 body. Assert: expected statuses per check
  id, score within band, remediation sources present for failures.
- `.github/workflows/eval.yml`: `bun install` → `bunx tsc --noEmit` → `bun run eval`
  on PRs and pushes to main.
- Acceptance: green on main; flipping one check's expected status to a wrong value
  fails the suite (verify once, then revert).

## Constraints

- Bun only (`bun add`, `bun run`). No npm.
- Zero-cost: OpenRouter free-tier models; no new paid services, no new infra.
- No behavior change to the audit verdicts — the graph refactor must be
  report-identical (Task 3 acceptance test proves it).
- TypeScript strict; no `any` leaks; keep existing code style (prettier config).
- Do not touch `src/components/ui/*`.

## Final verification (run in order, all must pass)

1. `bun install`
2. `bunx tsc --noEmit` → 0 errors
3. `bun run rag:ingest` → vectors file written
4. `bun run eval` → all green
5. `bun run build` → clean
6. `git grep -nE "ProbeKit|probekit" -- . ':!bun.lock'` → zero (except protected deploy URL)
7. `bun run dev` → spot-check `/`, `/dashboard`, one demo audit, fixes section renders

Summarize per task when done, including the manual steps left (GitHub repo rename →
`Preflight`, Vercel rename + redeploy + URL updates, `assets.png` refresh).
