# ASP ProbeKit

> Test your ASP before OKX.AI tests it.

ASP ProbeKit is an independent protocol-readiness scanner for free and
x402-powered A2MCP endpoints. It checks public availability, HTTPS behavior,
JSON responses, x402 v2 challenges, X Layer payment fields, and common
configuration failures, then returns a structured report with actionable
fixes.

![ASP ProbeKit product preview](./ChatGPT%20Image%20Jul%2027%2C%202026%2C%2012_55_18%20AM.png)

## Why ProbeKit?

An ASP can work locally and still fail marketplace review because of a missing
header, unsafe redirect, malformed response, or invalid payment challenge.
ProbeKit turns those failures into deterministic checks developers can run
before submitting their service.

- Audits free HTTP 200 and paid HTTP 402 endpoints
- Decodes and validates `PAYMENT-REQUIRED`
- Checks x402 version 2 challenge structure
- Validates X Layer network identifier `eip155:196`
- Reports evidence and an exact recommended fix
- Blocks private, loopback, link-local, reserved, and metadata destinations
- Requires no account, wallet, database, or API secret

## Product preview

The application includes:

- A responsive product landing page
- An interactive endpoint-audit dashboard
- Animated scan progress and readiness scoring
- Expandable evidence and remediation cards
- Copy and JSON report export actions
- Built-in free and x402 demonstration endpoints

## API

### Health check

```http
GET /api/health
```

Example response:

```json
{
  "status": "ok",
  "service": "ASP ProbeKit",
  "version": "1.0.0",
  "timestamp": "2026-07-27T10:00:00.000Z"
}
```

### Audit an endpoint

```http
POST /api/audit
Content-Type: application/json
```

```json
{
  "targetUrl": "https://example.com/api/service",
  "method": "GET",
  "requestBody": {}
}
```

`method` accepts `GET` or `POST` and defaults to `GET`. `requestBody` must be a
JSON object and is used only for POST audits.

The response contains:

- Endpoint classification
- Readiness score and label
- HTTP status and duration
- Passed checks, warnings, and failures
- Supporting evidence
- Recommended fixes

### Demonstration endpoints

| Endpoint | Behavior |
| --- | --- |
| `GET /api/demo/free` | Valid free endpoint returning HTTP 200 and JSON |
| `GET /api/demo/broken-x402` | Intentionally broken HTTP 402 response |
| `GET /api/demo/valid-x402` | Structurally valid x402 v2 demonstration |

The valid x402 endpoint is a structural demonstration only. No payment is
submitted or settled.

## Security model

ProbeKit treats every submitted URL as untrusted.

- HTTPS destinations only
- DNS resolution before outbound requests
- Private and reserved IP rejection
- Redirect destination revalidation
- Maximum three redirects
- Five-second request timeout
- 256 KB response-body limit
- 32 KB audit-request limit
- No user-supplied authorization headers
- No cookies, secrets, or full unbounded bodies returned
- No remote HTML execution

The MVP validates payment-challenge structure. It does not pay challenges,
sign authorizations, replay paid requests, or verify settlement.

## Local development

Requirements:

- Node.js 20 or newer
- Bun 1.3 or newer
- Git

```bash
git clone https://github.com/ShivamSoni20/ProbeKit.git
cd ProbeKit
bun install --frozen-lockfile
bun run dev
```

Create a production bundle:

```bash
bun run build
```

The production server output is generated in `.output/`.

## Technology

- TanStack Start
- React 19
- TypeScript
- Tailwind CSS
- Zod
- Radix UI
- Lucide
- Nitro

## Architecture

```text
Browser
  |
  v
TanStack Start dashboard
  |
  v
POST /api/audit
  |
  +-- Validate request and HTTPS URL
  +-- Resolve and validate destination
  +-- Fetch with timeout and redirect controls
  +-- Inspect HTTP and JSON behavior
  +-- Decode and validate x402 challenge
  +-- Calculate deterministic readiness score
  |
  v
Structured JSON report
```

## Hackathon

ASP ProbeKit was built for the **OKX.AI Genesis Hackathon** in the **Software
Services / Software Utility** category.

- Service name: `ASP ProbeKit`
- A2MCP price: Free
- Positioning: Preflight validator for free and x402-powered A2MCP endpoints

## Disclaimer

ASP ProbeKit evaluates documented protocol behavior and independent readiness
checks. A passing result does not guarantee OKX.AI marketplace approval.

## License

No open-source license has been selected yet. All rights are reserved unless a
license is added to this repository.
