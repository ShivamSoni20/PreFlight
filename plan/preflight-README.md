# Preflight

> **Test your agent service before the marketplace does.**

**Preflight is the preflight check for the agent economy** — it takes any public
HTTPS endpoint, runs it through a LangGraph-orchestrated battery of deterministic
network, protocol, and payment-challenge probes, and returns a readiness score with
evidence for every check and RAG-grounded fixes for every failure.

[![Live](https://img.shields.io/badge/Live-preflight-flax.vercel.app-B7FF3C?style=for-the-badge)](https://probe-kit-flax.vercel.app)
[![TanStack](https://img.shields.io/badge/TanStack-Start-FF4154?style=flat-square)](https://tanstack.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-121212?style=flat-square)](https://www.langchain.com/langgraph)

[Launch Preflight](https://probe-kit-flax.vercel.app) · [Run an audit](https://probe-kit-flax.vercel.app/dashboard) · [How it works](#how-it-works) · [API](#api-reference)

---

## The problem

An endpoint can work locally and still fail as an agent service: the URL resolves to
an unsafe destination, returns the wrong status, omits a payment header, encodes an
invalid x402 challenge, or targets the wrong network. Marketplace review then becomes
a slow, uncertain loop of submit → reject → guess.

Preflight converts that loop into a repeatable preflight:

1. Submit a public HTTPS endpoint.
2. Preflight safely probes its network and protocol behavior through a validated tool harness.
3. Receive a readiness score, evidence for every check, a manifest of everything probed — and grounded fixes for what failed.

## What Preflight validates

| Area | Validation |
|---|---|
| Connectivity | URL parsing, HTTPS enforcement, public DNS resolution, reachability, latency |
| HTTP behavior | Status codes, redirects, response size, JSON structure |
| Free A2MCP | Direct HTTP `200` service responses |
| x402 v2 | HTTP `402`, `PAYMENT-REQUIRED`, Base64 decoding, challenge shape |
| X Layer | CAIP-2 network identifier `eip155:196`, payment-option fields |
| Security | Private-network blocking, redirect revalidation, timeouts, size limits |

## How it works

```
Developer ──► POST /api/audit ──► LangGraph pipeline ──► Readiness report
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
              validate_input      safety_gate            fetch
              (Zod schema)        (DNS + SSRF block)     (bounded, 5s)
                                        │
                                   classify (200 / 402 / other)
                                   ╱        │         ╲
                          free_checks  x402_checks  http_failure
                                   ╲        │         ╱
                                   aggregate (deterministic score)
                                        │
                                   remediate (RAG + LLM, cited fixes)
                                        │
                              Score + evidence + fixes + probe manifest
```

**The design principle:** the graph orchestrates deterministic tools; the LLM is used
in exactly one node — rewriting retrieved fixes into concrete remediation steps.
AI reasons about wording. Code owns every verdict.

## Why it's interesting (the AI engineering)

- **LangGraph over deterministic tools.** The audit pipeline is a `StateGraph`:
  validation → safety gate → fetch → classify → branch → aggregate → remediate.
  Each node records timing into a probe manifest, so every report proves what was
  checked, in what order, and how long it took.
- **RAG-grounded remediation.** Failed checks retrieve similar past failures from an
  embedded knowledge base of x402/A2MCP misconfigurations — fixes cite their sources
  instead of being templated guesses.
- **Validated tool harness.** Every probe is a JSON-schema-validated tool with
  declared timeouts and byte budgets. Budget breaches are killed and logged, never silent.
- **Graceful degradation.** If the LLM or embeddings are unavailable, remediation
  falls back to built-in fixes — the audit itself never fails.
- **Eval-gated.** A golden suite over demo fixtures and adversarial cases
  (private-IP targets, malformed challenges) runs in CI. A broken check fails the build.
- **Security as architecture, not a feature list.** HTTPS-only, DNS pre-resolution,
  private/loopback/link-local/metadata blocking, redirect revalidation, no forwarded
  credentials, no remote HTML execution. Every submitted target is treated as untrusted.

## Live demonstration

The dashboard ships deterministic fixtures — evaluate the full workflow with no
wallet and no real payment:

| Scenario | Endpoint | Expected result |
|---|---|---|
| Valid free service | `GET /api/demo/free` | HTTP `200` with structured JSON |
| Broken x402 service | `GET /api/demo/broken-x402` | HTTP `402` with a missing challenge |
| Valid x402 structure | `GET /api/demo/valid-x402` | Structurally valid x402 v2 challenge |

The valid x402 fixture validates protocol structure only. It never requests, signs,
submits, or settles a payment.

## API reference

### Audit an endpoint

```http
POST /api/audit
Content-Type: application/json
```

```json
{
  "targetUrl": "https://probe-kit-flax.vercel.app/api/demo/free",
  "method": "GET"
}
```

```bash
curl --request POST "https://probe-kit-flax.vercel.app/api/audit" \
  --header "Content-Type: application/json" \
  --data '{"targetUrl":"https://probe-kit-flax.vercel.app/api/demo/free","method":"GET"}'
```

Every audit returns: endpoint type and HTTP status · readiness label and score ·
response time · passed/warned/failed checks with evidence · recommended fixes with
sources · probe manifest.

### Health check

```http
GET /api/health
```

## Run locally

Requirements: Node.js 20+, Bun 1.3+, Git. Optional: an OpenRouter-compatible API key
for LLM-grounded remediation (audits work fully without it).

```bash
git clone https://github.com/ShivamSoni20/Preflight.git
cd Preflight
bun install --frozen-lockfile
cp .env.example .env   # add AI_API_KEY to enable LLM remediation
bun run rag:ingest     # build the remediation knowledge base vectors
bun run dev
```

```bash
bun run eval    # golden eval suite
bun run build   # production build (Nitro → .output/)
```

## Technology

`TanStack Start` · `React 19` · `TypeScript` · `LangGraph` · `LangChain` ·
`OpenRouter` · `Tailwind CSS` · `Zod` · `Radix UI` · `Nitro` · `Bun`

## Roadmap

- [x] Deterministic audit engine with SSRF-safe probing
- [x] LangGraph-orchestrated pipeline with probe manifest
- [x] RAG-grounded remediation with cited fixes
- [x] Validated tool harness with budgets and dry-run
- [x] Eval harness gating CI
- [ ] Scheduled re-audits with drift alerts
- [ ] MCP server exposing `preflight.audit` as a tool for coding agents

## Project status

Preflight is deployed and operational. It was originally built as ProbeKit for the
OKX.AI Genesis hackathon (Software Services / Utility). Passing Preflight's
independent checks improves readiness but does not guarantee marketplace approval.

## License

No open-source license has been selected yet. All rights are reserved unless a
license is added to this repository.
