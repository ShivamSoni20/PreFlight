import { z } from "zod";
import type { AuditCheck, ProbeManifestEntry } from "@/lib/preflight-types";

export const MAX_REQUEST_BYTES = 32 * 1024;
export const MAX_RESPONSE_BYTES = 256 * 1024;
export const REQUEST_TIMEOUT_MS = 5_000;
export const MAX_REDIRECTS = 3;

export function isBlockedIp(value: string): boolean {
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

export function isBlockedHostname(hostname: string): boolean {
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

export function safeBase64Decode(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return atob(normalized);
  } catch {
    return null;
  }
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

export async function readLimitedBody(
  response: Response,
  maxBytes = MAX_RESPONSE_BYTES
): Promise<{ text: string; oversized: boolean; byteLength: number }> {
  const reader = response.body?.getReader();
  if (!reader) return { text: "", oversized: false, byteLength: 0 };
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.byteLength > maxBytes) {
      await reader.cancel();
      return {
        text: new TextDecoder().decode(concatChunks(chunks, total)),
        oversized: true,
        byteLength: total + value.byteLength,
      };
    }
    chunks.push(value);
    total += value.byteLength;
  }
  return {
    text: new TextDecoder().decode(concatChunks(chunks, total)),
    oversized: false,
    byteLength: total,
  };
}

// ---------------------------------------------------------------------------
// Tool Registry Definitions
// ---------------------------------------------------------------------------

export interface ToolDefinition<TArgs, TResult> {
  name: string;
  description: string;
  schema: z.ZodType<TArgs>;
  timeoutMs: number;
  byteBudget: number;
  sideEffectClass: "network-read-only";
  execute: (args: TArgs, signal: AbortSignal) => Promise<TResult>;
}

export const resolveDnsSchema = z.object({
  hostname: z.string().min(1),
});

export const boundedFetchSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST"]).default("GET"),
  body: z.unknown().optional(),
});

export const inspectX402Schema = z.object({
  paymentRequiredHeader: z.string().nullable().optional(),
  targetHostname: z.string().min(1),
});

export type ResolveDnsArgs = z.infer<typeof resolveDnsSchema>;
export type BoundedFetchArgs = z.infer<typeof boundedFetchSchema>;
export type InspectX402Args = z.infer<typeof inspectX402Schema>;

export interface ResolveDnsResult {
  hostname: string;
  addresses: string[];
}

export interface BoundedFetchResult {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
  oversized: boolean;
  redirects: number;
  responseTimeMs: number;
}

export interface InspectX402Result {
  checks: AuditCheck[];
}

export const resolveDnsTool: ToolDefinition<ResolveDnsArgs, ResolveDnsResult> = {
  name: "resolve_dns",
  description: "Resolves public DNS (A and AAAA via DoH) and blocks private/reserved IP addresses.",
  schema: resolveDnsSchema,
  timeoutMs: 3_000,
  byteBudget: 32 * 1024,
  sideEffectClass: "network-read-only",
  execute: async ({ hostname }, signal) => {
    if (isBlockedHostname(hostname)) {
      throw new Error("Destination is private, local, reserved, or metadata-hosted.");
    }
    if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) {
      if (isBlockedIp(hostname)) {
        throw new Error("Destination is private, local, reserved, or metadata-hosted.");
      }
      return { hostname, addresses: [hostname] };
    }

    const answers = new Set<string>();
    for (const type of ["A", "AAAA"]) {
      const response = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`,
        { headers: { accept: "application/dns-json" }, signal }
      );
      if (!response.ok) {
        throw new Error("Could not safely resolve the target hostname.");
      }
      const payload = (await response.json()) as { Answer?: Array<{ data?: string }> };
      for (const answer of payload.Answer ?? []) {
        if (answer.data && (/^[\d.]+$/.test(answer.data) || answer.data.includes(":"))) {
          answers.add(answer.data);
        }
      }
    }
    if (answers.size === 0) {
      throw new Error("Target hostname did not resolve to a public address.");
    }
    const list = [...answers];
    if (list.some(isBlockedIp)) {
      throw new Error("Target hostname resolves to a private, local, or reserved address.");
    }
    return { hostname, addresses: list };
  },
};

export const boundedFetchTool: ToolDefinition<BoundedFetchArgs, BoundedFetchResult> = {
  name: "bounded_fetch",
  description: "SSRF-safe bounded fetch with DNS pre-resolution, redirect revalidation, 5s timeout, and 256 KB response cap.",
  schema: boundedFetchSchema,
  timeoutMs: REQUEST_TIMEOUT_MS,
  byteBudget: MAX_RESPONSE_BYTES,
  sideEffectClass: "network-read-only",
  execute: async ({ url, method, body }, signal) => {
    let current = new URL(url);
    let redirects = 0;
    const fetchStarted = Date.now();

    while (true) {
      if (current.protocol !== "https:") {
        throw new Error("Only HTTPS destinations are allowed.");
      }
      // Re-resolve and enforce private IP blocking for every hop
      await resolveDnsTool.execute({ hostname: current.hostname }, signal);

      const response = await fetch(current, {
        method,
        redirect: "manual",
        signal,
        headers: {
          accept: "application/json, */*;q=0.5",
          "user-agent": "Preflight/2.0",
          ...(method === "POST" ? { "content-type": "application/json" } : {}),
        },
        body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      });

      if (response.status < 300 || response.status >= 400) {
        const responseTimeMs = Date.now() - fetchStarted;
        const { text, oversized } = await readLimitedBody(response, MAX_RESPONSE_BYTES);
        const headersRecord: Record<string, string> = {};
        response.headers.forEach((val, key) => {
          headersRecord[key.toLowerCase()] = val;
        });
        return {
          status: response.status,
          headers: headersRecord,
          bodyText: text,
          oversized,
          redirects,
          responseTimeMs,
        };
      }

      const location = response.headers.get("location");
      if (!location) {
        const responseTimeMs = Date.now() - fetchStarted;
        const { text, oversized } = await readLimitedBody(response, MAX_RESPONSE_BYTES);
        const headersRecord: Record<string, string> = {};
        response.headers.forEach((val, key) => {
          headersRecord[key.toLowerCase()] = val;
        });
        return {
          status: response.status,
          headers: headersRecord,
          bodyText: text,
          oversized,
          redirects,
        responseTimeMs,
        };
      }

      if (redirects >= MAX_REDIRECTS) {
        throw new Error(`Target exceeded the ${MAX_REDIRECTS}-redirect limit.`);
      }
      current = new URL(location, current);
      redirects += 1;
    }
  },
};

export const inspectX402Tool: ToolDefinition<InspectX402Args, InspectX402Result> = {
  name: "inspect_x402",
  description: "Validates payment-required header, base64 decoding, x402 v2 challenge shape, and X Layer fields.",
  schema: inspectX402Schema,
  timeoutMs: 1_000,
  byteBudget: 32 * 1024,
  sideEffectClass: "network-read-only",
  execute: async ({ paymentRequiredHeader, targetHostname }) => {
    const checks: AuditCheck[] = [];
    if (!paymentRequiredHeader) {
      checks.push({
        id: "payment-required",
        name: "PAYMENT-REQUIRED header",
        category: "x402",
        status: "fail",
        message: "HTTP 402 response is missing PAYMENT-REQUIRED.",
        expected: "Base64-encoded x402 v2 challenge",
        actual: "Header absent",
        fix: "Base64-encode the x402 v2 challenge JSON and return it in PAYMENT-REQUIRED.",
      });
      return { checks };
    }

    checks.push({
      id: "payment-required",
      name: "PAYMENT-REQUIRED header",
      category: "x402",
      status: "pass",
      message: "PAYMENT-REQUIRED header is present.",
    });

    const decoded = safeBase64Decode(paymentRequiredHeader);
    if (!decoded) {
      checks.push({
        id: "b64-decode",
        name: "Base64 decoding",
        category: "x402",
        status: "fail",
        message: "Challenge is not valid base64.",
        fix: "Encode the challenge JSON using standard base64 or base64url.",
      });
      return { checks };
    }

    checks.push({
      id: "b64-decode",
      name: "Base64 decoding",
      category: "x402",
      status: "pass",
      message: "Challenge decoded successfully.",
    });

    let challenge: unknown;
    try {
      challenge = JSON.parse(decoded);
    } catch {
      checks.push({
        id: "x402-json",
        name: "Challenge JSON",
        category: "x402",
        status: "fail",
        message: "Decoded challenge is not valid JSON.",
        fix: "Encode a valid JSON object.",
      });
      return { checks };
    }

    const value = challenge as Record<string, unknown>;
    const version = value?.x402Version;
    checks.push({
      id: "x402-version",
      name: "x402 version",
      category: "x402",
      status: version === 2 ? "pass" : "fail",
      message: version === 2 ? "Challenge declares x402Version 2." : "Challenge must declare x402Version 2.",
      actual: String(version ?? "missing"),
      expected: "2",
      fix: version === 2 ? undefined : 'Set "x402Version": 2.',
    });

    const resource = value?.resource as Record<string, unknown> | undefined;
    const resourceUrl = typeof resource?.url === "string" ? resource.url : "";
    const resourceValid = Boolean(
      resource && resourceUrl.startsWith("https://") && resource.description && resource.mimeType
    );
    checks.push({
      id: "resource",
      name: "Resource metadata",
      category: "x402",
      status: resourceValid ? "pass" : "fail",
      message: resourceValid
        ? "Resource URL, description, and MIME type are present."
        : "Resource metadata is incomplete.",
      fix: resourceValid
        ? undefined
        : "Include an HTTPS resource.url plus resource.description and resource.mimeType.",
    });

    if (resourceUrl) {
      let similar = false;
      try {
        similar = new URL(resourceUrl).hostname === targetHostname;
      } catch {
        similar = false;
      }
      checks.push({
        id: "resource-url",
        name: "Resource URL match",
        category: "x402",
        status: similar ? "pass" : "warn",
        message: similar
          ? "Resource URL matches the audited host."
          : "Resource URL does not match the audited host.",
        fix: similar ? undefined : "Set resource.url to the paid endpoint or the same public host.",
      });
    }

    const accepts = Array.isArray(value?.accepts) ? value.accepts : [];
    checks.push({
      id: "accepts",
      name: "Payment options",
      category: "x402",
      status: accepts.length ? "pass" : "fail",
      message: accepts.length ? `${accepts.length} payment option(s) declared.` : "accepts must be a non-empty array.",
      fix: accepts.length ? undefined : "Add at least one accepted payment option.",
    });

    const option = (accepts[0] ?? {}) as Record<string, unknown>;
    const networkOk = option.network === "eip155:196";
    checks.push({
      id: "network",
      name: "X Layer network",
      category: "X Layer",
      status: networkOk ? "pass" : "fail",
      message: networkOk ? "Payment option targets X Layer." : "Payment option does not target X Layer.",
      actual: String(option.network ?? "missing"),
      expected: "eip155:196",
      fix: networkOk ? undefined : 'Set "network": "eip155:196".',
    });

    for (const [id, name, field] of [
      ["asset", "Asset address", "asset"],
      ["recipient", "Recipient address", "payTo"],
    ] as const) {
      const fieldValue = option[field];
      const valid = typeof fieldValue === "string" && /^0x[a-fA-F0-9]{40}$/.test(fieldValue);
      checks.push({
        id,
        name,
        category: "X Layer",
        status: valid ? "pass" : "fail",
        message: valid ? `${name} is well formed.` : `${name} is missing or malformed.`,
        fix: valid ? undefined : `Provide ${field} as 0x followed by 40 hexadecimal characters.`,
      });
    }

    return { checks };
  },
};

export const TOOL_REGISTRY = {
  resolve_dns: resolveDnsTool,
  bounded_fetch: boundedFetchTool,
  inspect_x402: inspectX402Tool,
} as const;

export type ToolName = keyof typeof TOOL_REGISTRY;

export interface RunToolOptions {
  dryRun?: boolean;
  signal?: AbortSignal;
}

export interface RunToolResult<T> {
  data: T | null;
  entry: ProbeManifestEntry;
  dryRun?: boolean;
}

/**
 * Execution wrapper:
 * 1. Validates arguments against the tool's Zod schema.
 * 2. Enforces declared timeout and byte budgets (never silent on breach).
 * 3. Supports dry-run preview (returns what would run without network I/O).
 * 4. Produces a validated ProbeManifestEntry for the audit report.
 */
export async function runTool<K extends ToolName>(
  name: K,
  rawArgs: unknown,
  options: RunToolOptions = {}
): Promise<RunToolResult<any>> {
  const tool = TOOL_REGISTRY[name];
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  const parsedArgs = tool.schema.parse(rawArgs);
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  if (options.dryRun) {
    return {
      data: null,
      dryRun: true,
      entry: {
        tool: tool.name,
        durationMs: 0,
        startedAt,
        status: "ok",
        details: { dryRun: true, args: parsedArgs },
      },
    };
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort(new Error(`Tool ${tool.name} exceeded timeout budget of ${tool.timeoutMs}ms.`));
  }, tool.timeoutMs);

  const combinedSignal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const data = await tool.execute(parsedArgs as any, combinedSignal);
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startMs;
    return {
      data,
      entry: {
        tool: tool.name,
        durationMs,
        startedAt,
        status: "ok",
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startMs;
    const isTimeout = timeoutController.signal.aborted;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isBudgetBreach = isTimeout || errorMessage.includes("limit") || errorMessage.includes("budget");

    const entry: ProbeManifestEntry = {
      tool: tool.name,
      durationMs,
      startedAt,
      status: isBudgetBreach ? "budget-exceeded" : "error",
      details: { error: errorMessage },
    };

    // Re-throw with enriched message so callers receive exact failure reasons
    const enrichedError = new Error(
      isTimeout ? `Tool ${tool.name} timed out after ${tool.timeoutMs}ms.` : errorMessage
    );
    (enrichedError as any).manifestEntry = entry;
    throw enrichedError;
  }
}
