import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { AuditCheck, AuditReport, EndpointType, Readiness } from "@/lib/probekit-types";

const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_RESPONSE_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;

const requestSchema = z.object({
  targetUrl: z.string().trim().min(1, "targetUrl is required.").max(2048),
  method: z.enum(["GET", "POST"]).default("GET"),
  requestBody: z.record(z.string(), z.unknown()).optional(),
}).strict();

function isBlockedIp(value: string): boolean {
  const host = value.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "::" || host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const octets = ipv4.slice(1).map(Number);
  if (octets.some((part) => part > 255)) return true;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    isBlockedIp(host)
  );
}

async function resolvePublicHost(hostname: string, signal: AbortSignal): Promise<string[]> {
  if (isBlockedHostname(hostname)) throw new Error("Destination is private, local, reserved, or metadata-hosted.");
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) return [hostname];

  const answers = new Set<string>();
  for (const type of ["A", "AAAA"]) {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`,
      { headers: { accept: "application/dns-json" }, signal },
    );
    if (!response.ok) throw new Error("Could not safely resolve the target hostname.");
    const payload = await response.json() as { Answer?: Array<{ data?: string }> };
    for (const answer of payload.Answer ?? []) {
      if (answer.data && (/^[\d.]+$/.test(answer.data) || answer.data.includes(":"))) answers.add(answer.data);
    }
  }
  if (answers.size === 0) throw new Error("Target hostname did not resolve to a public address.");
  if ([...answers].some(isBlockedIp)) throw new Error("Target hostname resolves to a private, local, or reserved address.");
  return [...answers];
}

function computeReadiness(score: number): Readiness {
  if (score >= 90) return "Protocol Ready";
  if (score >= 75) return "Almost Ready";
  if (score >= 50) return "Needs Fixes";
  return "Not Ready";
}

function safeBase64Decode(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return atob(normalized);
  } catch {
    return null;
  }
}

async function readLimitedBody(response: Response): Promise<{ text: string; oversized: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) return { text: "", oversized: false };
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.byteLength > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      return { text: new TextDecoder().decode(concatChunks(chunks, total)), oversized: true };
    }
    chunks.push(value);
    total += value.byteLength;
  }
  return { text: new TextDecoder().decode(concatChunks(chunks, total)), oversized: false };
}

function concatChunks(chunks: Uint8Array[], length: number): Uint8Array {
  const merged = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

async function safeFetch(initialUrl: URL, method: "GET" | "POST", body: unknown, signal: AbortSignal) {
  let current = initialUrl;
  let redirects = 0;
  while (true) {
    if (current.protocol !== "https:") throw new Error("Only HTTPS destinations are allowed.");
    await resolvePublicHost(current.hostname, signal);
    const response = await fetch(current, {
      method,
      redirect: "manual",
      signal,
      headers: {
        accept: "application/json, */*;q=0.5",
        "user-agent": "ASP-ProbeKit/1.0 (+preflight)",
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    });
    if (response.status < 300 || response.status >= 400) return { response, redirects };
    const location = response.headers.get("location");
    if (!location) return { response, redirects };
    if (redirects >= MAX_REDIRECTS) throw new Error(`Target exceeded the ${MAX_REDIRECTS}-redirect limit.`);
    current = new URL(location, current);
    redirects += 1;
  }
}

async function runAudit(targetUrl: string, method: "GET" | "POST", body: unknown): Promise<AuditReport> {
  const checks: AuditCheck[] = [];
  const started = Date.now();
  let url: URL;
  try {
    url = new URL(targetUrl);
    checks.push({ id: "valid-url", name: "Valid URL", category: "Connectivity", status: "pass", message: "URL parsed successfully.", actual: targetUrl });
  } catch {
    checks.push({ id: "valid-url", name: "Valid URL", category: "Connectivity", status: "fail", message: "Target is not a valid URL.", actual: targetUrl, expected: "https://host/path", fix: "Provide a full HTTPS URL." });
    return finalize(checks, targetUrl, started, null, "Unreachable");
  }

  if (url.username || url.password) {
    checks.push({ id: "credentials", name: "URL credentials", category: "Connectivity", status: "fail", message: "Credentials in target URLs are not allowed.", fix: "Remove the username and password from the URL." });
    return finalize(checks, targetUrl, started, null, "Unreachable");
  }
  if (url.protocol !== "https:") {
    checks.push({ id: "https", name: "HTTPS scheme", category: "Connectivity", status: "fail", message: `Scheme "${url.protocol}" is not HTTPS.`, expected: "https:", actual: url.protocol, fix: "Serve the endpoint over HTTPS with a valid TLS certificate." });
    return finalize(checks, targetUrl, started, null, "Unreachable");
  }
  checks.push({ id: "https", name: "HTTPS scheme", category: "Connectivity", status: "pass", message: "Endpoint uses HTTPS." });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const requestStarted = Date.now();
    const { response, redirects } = await safeFetch(url, method, body, controller.signal);
    const responseTimeMs = Date.now() - requestStarted;
    const { text: responseText, oversized } = await readLimitedBody(response);
    checks.push({ id: "public-host", name: "Public destination", category: "Connectivity", status: "pass", message: "Hostname resolves only to public addresses.", actual: url.hostname });
    checks.push({ id: "reachability", name: "Endpoint reachability", category: "Connectivity", status: "pass", message: `Connected in ${responseTimeMs}ms.`, actual: `${responseTimeMs}ms` });
    checks.push({
      id: "latency", name: "Response latency", category: "Connectivity",
      status: responseTimeMs < 1_500 ? "pass" : responseTimeMs < 5_000 ? "warn" : "fail",
      message: `Endpoint responded in ${responseTimeMs}ms.`,
      fix: responseTimeMs >= 1_500 ? "Reduce endpoint latency; under 1.5 seconds is preferred." : undefined,
    });
    checks.push({
      id: "redirect", name: "Redirect behavior", category: "HTTP",
      status: redirects === 0 ? "pass" : "warn",
      message: redirects === 0 ? "No redirects were required." : `Followed ${redirects} validated redirect(s).`,
      fix: redirects ? "Use the final HTTPS endpoint directly." : undefined,
    });
    checks.push({
      id: "response-size", name: "Response size", category: "HTTP",
      status: oversized ? "fail" : "pass",
      message: oversized ? `Response exceeded the ${MAX_RESPONSE_BYTES / 1024} KB limit.` : "Response stayed within the size limit.",
      fix: oversized ? "Return a smaller JSON response." : undefined,
    });

    let endpointType: EndpointType = "Unknown";
    const contentType = response.headers.get("content-type") ?? "";
    if (response.status === 402) {
      endpointType = "x402";
      checks.push({ id: "http-402", name: "HTTP 402 response", category: "x402", status: "pass", message: "Endpoint returned HTTP 402 for a paid service." });
      inspectX402(response.headers.get("payment-required"), checks, url);
    } else if (response.status === 200) {
      endpointType = "Free A2MCP";
      checks.push({ id: "http-status", name: "HTTP 200 response", category: "HTTP", status: "pass", message: "Free endpoint returned HTTP 200." });
      checks.push({
        id: "content-type", name: "Content type", category: "HTTP",
        status: contentType.toLowerCase().includes("application/json") ? "pass" : "warn",
        message: contentType ? `Response content type: ${contentType}.` : "Response omitted Content-Type.",
        fix: contentType.toLowerCase().includes("application/json") ? undefined : "Set Content-Type: application/json.",
      });
      try {
        JSON.parse(responseText);
        checks.push({ id: "json-parse", name: "JSON parsing", category: "HTTP", status: "pass", message: "Response body is valid JSON.", evidence: responseText.slice(0, 400) });
      } catch {
        checks.push({ id: "json-parse", name: "JSON parsing", category: "HTTP", status: "fail", message: "Response body is not valid JSON.", evidence: responseText.slice(0, 400), fix: "Return a valid JSON body." });
      }
    } else {
      checks.push({ id: "http-status", name: "Expected HTTP status", category: "HTTP", status: "fail", message: `Unexpected HTTP status ${response.status}.`, expected: "200 or 402", actual: String(response.status), fix: "Return 200 with JSON for a free service, or 402 with a PAYMENT-REQUIRED challenge." });
    }
    return finalize(checks, targetUrl, started, response.status, endpointType, responseTimeMs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reach endpoint.";
    const timedOut = controller.signal.aborted;
    checks.push({
      id: "reachability", name: "Endpoint reachability", category: "Connectivity", status: "fail",
      message: timedOut ? `Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.` : message,
      fix: timedOut ? "Respond within five seconds." : "Use a publicly reachable HTTPS endpoint that does not resolve to a private network.",
    });
    return finalize(checks, targetUrl, started, null, "Unreachable");
  } finally {
    clearTimeout(timeout);
  }
}

function inspectX402(header: string | null, checks: AuditCheck[], target: URL) {
  if (!header) {
    checks.push({ id: "payment-required", name: "PAYMENT-REQUIRED header", category: "x402", status: "fail", message: "HTTP 402 response is missing PAYMENT-REQUIRED.", expected: "Base64-encoded x402 v2 challenge", actual: "Header absent", fix: "Base64-encode the x402 v2 challenge JSON and return it in PAYMENT-REQUIRED." });
    return;
  }
  checks.push({ id: "payment-required", name: "PAYMENT-REQUIRED header", category: "x402", status: "pass", message: "PAYMENT-REQUIRED header is present." });
  const decoded = safeBase64Decode(header);
  if (!decoded) {
    checks.push({ id: "b64-decode", name: "Base64 decoding", category: "x402", status: "fail", message: "Challenge is not valid base64.", fix: "Encode the challenge JSON using standard base64 or base64url." });
    return;
  }
  checks.push({ id: "b64-decode", name: "Base64 decoding", category: "x402", status: "pass", message: "Challenge decoded successfully." });
  try {
    validateX402(JSON.parse(decoded), checks, target);
  } catch {
    checks.push({ id: "x402-json", name: "Challenge JSON", category: "x402", status: "fail", message: "Decoded challenge is not valid JSON.", fix: "Encode a valid JSON object." });
  }
}

function validateX402(challenge: unknown, checks: AuditCheck[], target: URL) {
  const value = challenge as Record<string, unknown>;
  const version = value?.x402Version;
  checks.push({
    id: "x402-version", name: "x402 version", category: "x402", status: version === 2 ? "pass" : "fail",
    message: version === 2 ? "Challenge declares x402Version 2." : "Challenge must declare x402Version 2.",
    actual: String(version ?? "missing"), expected: "2", fix: version === 2 ? undefined : 'Set "x402Version": 2.',
  });

  const resource = value?.resource as Record<string, unknown> | undefined;
  const resourceUrl = typeof resource?.url === "string" ? resource.url : "";
  const resourceValid = Boolean(resource && resourceUrl.startsWith("https://") && resource.description && resource.mimeType);
  checks.push({
    id: "resource", name: "Resource metadata", category: "x402", status: resourceValid ? "pass" : "fail",
    message: resourceValid ? "Resource URL, description, and MIME type are present." : "Resource metadata is incomplete.",
    fix: resourceValid ? undefined : "Include an HTTPS resource.url plus resource.description and resource.mimeType.",
  });
  if (resourceUrl) {
    let similar = false;
    try { similar = new URL(resourceUrl).hostname === target.hostname; } catch { similar = false; }
    checks.push({ id: "resource-url", name: "Resource URL match", category: "x402", status: similar ? "pass" : "warn", message: similar ? "Resource URL matches the audited host." : "Resource URL does not match the audited host.", fix: similar ? undefined : "Set resource.url to the paid endpoint or the same public host." });
  }

  const accepts = Array.isArray(value?.accepts) ? value.accepts : [];
  checks.push({ id: "accepts", name: "Payment options", category: "x402", status: accepts.length ? "pass" : "fail", message: accepts.length ? `${accepts.length} payment option(s) declared.` : "accepts must be a non-empty array.", fix: accepts.length ? undefined : "Add at least one accepted payment option." });
  const option = (accepts[0] ?? {}) as Record<string, unknown>;
  const networkOk = option.network === "eip155:196";
  checks.push({ id: "network", name: "X Layer network", category: "X Layer", status: networkOk ? "pass" : "fail", message: networkOk ? "Payment option targets X Layer." : "Payment option does not target X Layer.", actual: String(option.network ?? "missing"), expected: "eip155:196", fix: networkOk ? undefined : 'Set "network": "eip155:196".' });
  for (const [id, name, field] of [["asset", "Asset address", "asset"], ["recipient", "Recipient address", "payTo"]] as const) {
    const fieldValue = option[field];
    const valid = typeof fieldValue === "string" && /^0x[a-fA-F0-9]{40}$/.test(fieldValue);
    checks.push({ id, name, category: "X Layer", status: valid ? "pass" : "fail", message: valid ? `${name} is well formed.` : `${name} is missing or malformed.`, fix: valid ? undefined : `Provide ${field} as 0x followed by 40 hexadecimal characters.` });
  }
  const amountValid = typeof option.amount === "string" && /^\d+$/.test(option.amount) && BigInt(option.amount) > 0n;
  checks.push({ id: "amount", name: "Amount", category: "X Layer", status: amountValid ? "pass" : "fail", message: amountValid ? "Amount is a positive numeric string." : "Amount must be a positive numeric string.", fix: amountValid ? undefined : 'Use a value such as "10000".' });
  const timeoutValid = typeof option.maxTimeoutSeconds === "number" && option.maxTimeoutSeconds > 0;
  checks.push({ id: "timeout", name: "Timeout", category: "X Layer", status: timeoutValid ? "pass" : "fail", message: timeoutValid ? "Payment timeout is positive." : "maxTimeoutSeconds must be positive.", fix: timeoutValid ? undefined : "Set maxTimeoutSeconds to a positive number." });
}

function finalize(checks: AuditCheck[], targetUrl: string, started: number, httpStatus: number | null, endpointType: EndpointType, responseTimeMs?: number): AuditReport {
  const passed = checks.filter((check) => check.status === "pass").length;
  const warnings = checks.filter((check) => check.status === "warn").length;
  const failed = checks.filter((check) => check.status === "fail").length;
  const total = passed + warnings + failed || 1;
  const score = Math.round(((passed + warnings * 0.5) / total) * 100);
  return {
    auditId: `audit_${crypto.randomUUID()}`,
    targetUrl,
    auditedAt: new Date().toISOString(),
    durationMs: responseTimeMs ?? Date.now() - started,
    httpStatus,
    endpointType,
    readiness: computeReadiness(score),
    score,
    summary: { passed, warnings, failed },
    checks,
    disclaimer: "ASP ProbeKit evaluates documented protocol behavior and independent readiness checks. A passing result does not guarantee OKX.AI marketplace approval.",
  };
}

export const Route = createFileRoute("/api/audit")({
  server: {
    handlers: {
      GET: async () => Response.json({
        error: "Method not allowed.",
        message: "ASP ProbeKit audits endpoints through POST /api/audit.",
        example: {
          targetUrl: "https://example.com/api/service",
          method: "GET",
          requestBody: {},
        },
      }, {
        status: 405,
        headers: { allow: "POST, OPTIONS", "cache-control": "no-store" },
      }),
      POST: async ({ request }) => {
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > MAX_REQUEST_BYTES) return Response.json({ error: "Request body exceeds 32 KB." }, { status: 413 });
        let raw: unknown;
        try {
          const text = await request.text();
          if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) return Response.json({ error: "Request body exceeds 32 KB." }, { status: 413 });
          raw = JSON.parse(text);
        } catch {
          return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
        }
        const parsed = requestSchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json({ error: "Invalid audit request.", issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 400 });
        }
        const report = await runAudit(parsed.data.targetUrl, parsed.data.method, parsed.data.requestBody);
        return Response.json(report, { headers: { "cache-control": "no-store" } });
      },
      OPTIONS: async () => new Response(null, { status: 204, headers: { allow: "POST, OPTIONS" } }),
    },
  },
});
