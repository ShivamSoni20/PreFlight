# Preflight — Integration Plan (ProbeKit → agentic trust layer)

**Rename:** ProbeKit → **Preflight** ("the preflight check before your agent flies").
**Goal:** turn the deterministic scanner into an agentic trust layer for the agent
economy — LangGraph-orchestrated probes, RAG-grounded remediation, a validated tool
harness — and make it a portfolio centerpiece for Founding AI Engineer / Applied AI /
AI Engineer / FDE roles. Zero-cost throughout (OpenRouter free tier; no new infra).

## Current state (read 2026-10-12)

- Stack: TanStack Start (React 19) + Nitro server, TypeScript, Tailwind v4 dark theme,
  Zod, Bun. **No database. No LLM calls anywhere.**
- Core engine: `src/routes/api/audit.ts` — SSRF-safe bounded fetch (DNS pre-resolution,
  private-IP blocking, redirect revalidation, 5s timeout, 256 KB cap) → deterministic
  checks (connectivity, HTTP, x402 v2, X Layer) → score + readiness label.
- UI: landing (`/`), dashboard (`/dashboard`) with 3 demo fixtures, report UI
  (ScoreGauge, CheckCard, JsonViewer).
- The elegant insight: the audit pipeline is already a DAG — LangGraph orchestrates
  **deterministic** probe tools; the LLM is used only where judgment is needed
  (remediation wording). This matches the "AI reasons, code decides" philosophy exactly.

## Phase 0 — Rename ProbeKit → Preflight

- In-repo rename across ~25 files (exact strings in the agent prompt): `ASP ProbeKit`
  → `Preflight`, `probekit-types.ts` → `preflight-types.ts`,
  `src/components/probekit/` → `src/components/preflight/`, `ProbeLogo` →
  `PreflightLogo`, user-agent → `Preflight/2.0`, `package.json` name → `preflight`,
  health endpoint service/version, all UI copy, meta titles, demo terminal strings.
- New stronger README (delivered alongside this plan) replaces the root README.
- **Manual steps for you:** GitHub repo Settings → rename to `Preflight`; Vercel
  project → rename + redeploy; then update live URLs in README/badges;
  regenerate `assets.png` screenshot.

## Phase 1 — Agent harness: probes as validated tools (~3 days)

**Why:** the scanner that *proves* what it checked. FDE catnip.

- `src/lib/harness/tools.ts`: JSON-schema (Zod) tool registry —
  `resolve_dns`, `bounded_fetch`, `inspect_x402`, each declaring timeout, byte budget,
  and side-effect class (`network-read-only`).
- Execution wrapper: schema validation → budget enforcement → dry-run preview →
  run → append-only probe log.
- `AuditReport` gains `probeManifest: { tool, durationMs, startedAt }[]`; dashboard
  shows it as an expandable "what was checked" section.
- **Acceptance:** every network call in an audit goes through the registry; a probe
  exceeding budget is killed and logged, never silent.

## Phase 2 — LangGraph audit pipeline (~1 week)

**Why:** LangGraph on the résumé, orchestrating deterministic tools — the rarest and
most credible shape.

- `bun add @langchain/langgraph @langchain/core`
- `src/lib/preflight-graph.ts` — `StateGraph` over `PreflightState`
  (targetUrl, method, checks[], endpointType, score, readiness, fixes[]):
  - Nodes (deterministic except the last): `validate_input` → `safety_gate` →
    `fetch` → `classify` → branch (`free_checks` | `x402_checks` | `http_failure`) →
    `aggregate` (existing scoring logic) → `remediate` (LLM + RAG, Phase 3/4) → END
  - Existing check functions move verbatim into node implementations — no behavior change.
- `src/routes/api/audit.ts` becomes a thin handler: parse → `graph.invoke()` →
  return report. API contract unchanged (dashboard keeps working).
- **Acceptance:** identical reports for the 3 demo fixtures before/after (diff test);
  graph exposes per-node timing in the probe manifest.

## Phase 3 — RAG remediation knowledge base (~4 days)

**Why:** grounded fixes beat templated advice — "3 endpoints with this x402
misconfiguration were fixed by…".

- `src/lib/remediation-kb.json`: ~25 curated failure-signature → fix pairs seeded
  from the existing `fix:` strings plus common x402/A2MCP misconfigurations.
- `scripts/rag-ingest.ts` (`bun run rag:ingest`): embeds signatures with a free
  OpenRouter embedding model → `src/lib/remediation-kb.vectors.json` (no new infra,
  works on serverless).
- `src/lib/rag-retriever.ts`: cosine search over failed check IDs + messages.
- `.env.example` (new): `AI_API_KEY`, `AI_API_BASE_URL`, `AI_MODEL`, `EMBEDDING_MODEL`.
- **Acceptance:** every failed check in the demo fixtures retrieves ≥1 relevant fix;
  irrelevant retrievals are filtered by similarity threshold.

## Phase 4 — LangChain structured remediation (~3 days)

**Why:** the one place the LLM earns its keep — and it does so with guardrails.

- `src/lib/ai.ts`: OpenRouter-compatible client (same pattern as Biz Coach).
- `remediate` node: for each failed check, retrieve KB entries → LangChain
  `withStructuredOutput` (Zod schema: `{ checkId, fix, confidence, sources[] }`) →
  append to `report.fixes`. Temperature 0.2. On any LLM failure: fall back to the
  existing static `fix:` strings — remediation degrades, the audit never does.
- Dashboard: new "Recommended fixes" section with per-fix source citations.
- **Acceptance:** fixes cite KB sources; LLM outage still yields a complete report.

## Phase 5 — Eval harness + CI (~3 days)

- `scripts/eval/`: golden set over the 3 demo fixtures + synthetic cases
  (malformed x402, private-IP target, slow endpoint) asserting expected check
  outcomes, score bands, and remediation citation precision. `bun run eval`.
- `.github/workflows/eval.yml`: typecheck + eval on PRs.
- **Acceptance:** suite green on main; a deliberately broken check fails CI.

## Phase 6 — Landing + README refresh (~2 days)

- New README (delivered) goes in as root `README.md`.
- Landing page: add an "Agentic pipeline" strip to `/#how` reflecting the LangGraph
  flow; update hero sub-copy to mention grounded remediation. No redesign.

## Phase 7 — Launch

1. Phases 0–5 merged; Vercel renamed + redeployed.
2. New `assets.png` screenshot; 60-second demo GIF → README.
3. GitHub profile pins: Recover → Preflight → Biz Coach → AmbiguityCompiler.
4. Launch posts: LinkedIn + X.

## Effort summary

| Phase | Estimate |
|---|---|
| 0 Rename + README | 2–3 days |
| 1 Harness | 3 days |
| 2 LangGraph | ~1 week |
| 3 RAG KB | 4 days |
| 4 LangChain remediation | 3 days |
| 5 Evals + CI | 3 days |
| 6 Landing refresh | 2 days |

Suggested order: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7. Total ≈ 4 weeks part-time.
