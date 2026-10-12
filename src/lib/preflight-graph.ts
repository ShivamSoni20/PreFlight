import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import type {
  AuditCheck,
  AuditReport,
  EndpointType,
  ProbeManifestEntry,
  Readiness,
  Remediation,
} from "@/lib/preflight-types";
import {
  runTool,
  REQUEST_TIMEOUT_MS,
  MAX_RESPONSE_BYTES,
} from "@/lib/harness/tools";
import { retrieveFixes } from "@/lib/rag-retriever";
import { generateRemediationWithLlm } from "@/lib/ai";

export const PreflightAnnotation = Annotation.Root({
  targetUrl: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => "" }),
  method: Annotation<"GET" | "POST">({ reducer: (x, y) => y ?? x, default: () => "GET" }),
  requestBody: Annotation<unknown>({ reducer: (x, y) => y ?? x, default: () => undefined }),
  urlObj: Annotation<URL | undefined>({ reducer: (x, y) => y ?? x, default: () => undefined }),
  checks: Annotation<AuditCheck[]>({ reducer: (x, y) => y ?? x, default: () => [] }),
  endpointType: Annotation<EndpointType>({ reducer: (x, y) => y ?? x, default: () => "Unknown" }),
  httpStatus: Annotation<number | null>({ reducer: (x, y) => y ?? x, default: () => null }),
  responseTimeMs: Annotation<number | undefined>({ reducer: (x, y) => y ?? x, default: () => undefined }),
  score: Annotation<number>({ reducer: (x, y) => y ?? x, default: () => 0 }),
  readiness: Annotation<Readiness>({ reducer: (x, y) => y ?? x, default: () => "Not Ready" }),
  fixes: Annotation<Remediation[]>({ reducer: (x, y) => y ?? x, default: () => [] }),
  probeManifest: Annotation<ProbeManifestEntry[]>({ reducer: (x, y) => y ?? x, default: () => [] }),
  auditId: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => "" }),
  startedAt: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => "" }),
  fetchResponse: Annotation<{
    status: number;
    headers: Record<string, string>;
    bodyText: string;
    oversized: boolean;
    redirects: number;
    responseTimeMs: number;
  } | undefined>({ reducer: (x, y) => y ?? x, default: () => undefined }),
  fatalError: Annotation<boolean | undefined>({ reducer: (x, y) => y ?? x, default: () => false }),
});

export type PreflightState = typeof PreflightAnnotation.State;

export function computeScore(checks: AuditCheck[]): number {
  const total = checks.length;
  if (!total) return 0;
  const weights: Record<string, number> = { pass: 1, warn: 0.5, fail: 0, info: 1 };
  const raw = checks.reduce((sum, c) => sum + (weights[c.status] ?? 0), 0);
  return Math.round((raw / total) * 100);
}

export function computeReadiness(score: number): Readiness {
  if (score >= 90) return "Protocol Ready";
  if (score >= 75) return "Almost Ready";
  if (score >= 50) return "Needs Fixes";
  return "Not Ready";
}

// ---------------------------------------------------------------------------
// Pipeline Graph Nodes
// ---------------------------------------------------------------------------

async function validateInputNode(state: PreflightState): Promise<Partial<PreflightState>> {
  const startMs = Date.now();
  const checks: AuditCheck[] = [...state.checks];
  const manifest = [...state.probeManifest];

  let urlObj: URL | undefined;
  let fatalError = false;

  try {
    urlObj = new URL(state.targetUrl);
    checks.push({
      id: "valid-url",
      name: "Valid URL",
      category: "Connectivity",
      status: "pass",
      message: "URL parsed successfully.",
      actual: state.targetUrl,
    });
  } catch {
    checks.push({
      id: "valid-url",
      name: "Valid URL",
      category: "Connectivity",
      status: "fail",
      message: "Target is not a valid URL.",
      actual: state.targetUrl,
      expected: "https://host/path",
      fix: "Provide a full HTTPS URL.",
    });
    fatalError = true;
  }

  if (urlObj && (urlObj.username || urlObj.password)) {
    checks.push({
      id: "credentials",
      name: "URL credentials",
      category: "Connectivity",
      status: "fail",
      message: "Credentials in target URLs are not allowed.",
      fix: "Remove the username and password from the URL.",
    });
    fatalError = true;
  }

  if (urlObj && urlObj.protocol !== "https:") {
    checks.push({
      id: "https",
      name: "HTTPS scheme",
      category: "Connectivity",
      status: "fail",
      message: `Scheme "${urlObj.protocol}" is not HTTPS.`,
      expected: "https:",
      actual: urlObj.protocol,
      fix: "Serve the endpoint over HTTPS with a valid TLS certificate.",
    });
    fatalError = true;
  } else if (urlObj) {
    checks.push({
      id: "https",
      name: "HTTPS scheme",
      category: "Connectivity",
      status: "pass",
      message: "Endpoint uses HTTPS.",
    });
  }

  manifest.push({
    tool: "validate_input",
    durationMs: Date.now() - startMs,
    startedAt: new Date(startMs).toISOString(),
    status: "ok",
  });

  return {
    urlObj,
    checks,
    fatalError,
    probeManifest: manifest,
    endpointType: fatalError ? "Unreachable" : state.endpointType,
  };
}

async function safetyGateNode(state: PreflightState): Promise<Partial<PreflightState>> {
  if (state.fatalError || !state.urlObj) {
    return {};
  }
  const startMs = Date.now();
  const checks = [...state.checks];
  const manifest = [...state.probeManifest];

  try {
    const { entry } = await runTool("resolve_dns", { hostname: state.urlObj.hostname });
    manifest.push(entry);
    checks.push({
      id: "public-host",
      name: "Public destination",
      category: "Connectivity",
      status: "pass",
      message: "Hostname resolves only to public addresses.",
      actual: state.urlObj.hostname,
    });
    return { checks, probeManifest: manifest };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const entry = (error as any).manifestEntry || {
      tool: "resolve_dns",
      durationMs: Date.now() - startMs,
      startedAt: new Date(startMs).toISOString(),
      status: "error",
      details: { error: msg },
    };
    manifest.push(entry);
    checks.push({
      id: "reachability",
      name: "Endpoint reachability",
      category: "Connectivity",
      status: "fail",
      message: msg,
      fix: "Use a publicly reachable HTTPS endpoint that does not resolve to a private network.",
    });
    return {
      checks,
      probeManifest: manifest,
      fatalError: true,
      endpointType: "Unreachable",
    };
  }
}

async function fetchNode(state: PreflightState): Promise<Partial<PreflightState>> {
  if (state.fatalError || !state.urlObj) {
    return {};
  }
  const startMs = Date.now();
  const checks = [...state.checks];
  const manifest = [...state.probeManifest];

  try {
    const { data: fetchRes, entry } = await runTool("bounded_fetch", {
      url: state.targetUrl,
      method: state.method,
      body: state.requestBody,
    });
    manifest.push(entry);

    const responseTimeMs = fetchRes.responseTimeMs;
    checks.push({
      id: "reachability",
      name: "Endpoint reachability",
      category: "Connectivity",
      status: "pass",
      message: `Connected in ${responseTimeMs}ms.`,
      actual: `${responseTimeMs}ms`,
    });
    checks.push({
      id: "latency",
      name: "Response latency",
      category: "Connectivity",
      status: responseTimeMs < 1_500 ? "pass" : responseTimeMs < 5_000 ? "warn" : "fail",
      message: `Endpoint responded in ${responseTimeMs}ms.`,
      fix: responseTimeMs >= 1_500 ? "Reduce endpoint latency; under 1.5 seconds is preferred." : undefined,
    });
    checks.push({
      id: "redirect",
      name: "Redirect behavior",
      category: "HTTP",
      status: fetchRes.redirects === 0 ? "pass" : "warn",
      message: fetchRes.redirects === 0 ? "No redirects were required." : `Followed ${fetchRes.redirects} validated redirect(s).`,
      fix: fetchRes.redirects ? "Use the final HTTPS endpoint directly." : undefined,
    });
    checks.push({
      id: "response-size",
      name: "Response size",
      category: "HTTP",
      status: fetchRes.oversized ? "fail" : "pass",
      message: fetchRes.oversized ? `Response exceeded the ${MAX_RESPONSE_BYTES / 1024} KB limit.` : "Response stayed within the size limit.",
      fix: fetchRes.oversized ? "Return a smaller JSON response." : undefined,
    });

    return {
      checks,
      probeManifest: manifest,
      fetchResponse: fetchRes,
      httpStatus: fetchRes.status,
      responseTimeMs,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Could not reach endpoint.";
    const entry = (error as any).manifestEntry || {
      tool: "bounded_fetch",
      durationMs: Date.now() - startMs,
      startedAt: new Date(startMs).toISOString(),
      status: "error",
      details: { error: msg },
    };
    manifest.push(entry);

    const timedOut = msg.includes("timeout") || msg.includes("timed out");
    checks.push({
      id: "reachability",
      name: "Endpoint reachability",
      category: "Connectivity",
      status: "fail",
      message: timedOut ? `Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.` : msg,
      fix: timedOut ? "Respond within five seconds." : "Use a publicly reachable HTTPS endpoint that does not resolve to a private network.",
    });

    return {
      checks,
      probeManifest: manifest,
      fatalError: true,
      endpointType: "Unreachable",
    };
  }
}

async function classifyNode(state: PreflightState): Promise<Partial<PreflightState>> {
  if (state.fatalError || !state.fetchResponse) {
    return { endpointType: "Unreachable" };
  }
  const status = state.fetchResponse.status;
  if (status === 402) {
    return { endpointType: "x402" };
  } else if (status === 200) {
    return { endpointType: "Free A2MCP" };
  }
  return { endpointType: "Unknown" };
}

async function freeChecksNode(state: PreflightState): Promise<Partial<PreflightState>> {
  const checks = [...state.checks];
  const res = state.fetchResponse!;
  const contentType = res.headers["content-type"] ?? "";

  checks.push({
    id: "http-status",
    name: "HTTP 200 response",
    category: "HTTP",
    status: "pass",
    message: "Free endpoint returned HTTP 200.",
  });
  checks.push({
    id: "content-type",
    name: "Content type",
    category: "HTTP",
    status: contentType.toLowerCase().includes("application/json") ? "pass" : "warn",
    message: contentType ? `Response content type: ${contentType}.` : "Response omitted Content-Type.",
    fix: contentType.toLowerCase().includes("application/json") ? undefined : "Set Content-Type: application/json.",
  });
  try {
    JSON.parse(res.bodyText);
    checks.push({
      id: "json-parse",
      name: "JSON parsing",
      category: "HTTP",
      status: "pass",
      message: "Response body is valid JSON.",
      evidence: res.bodyText.slice(0, 400),
    });
  } catch {
    checks.push({
      id: "json-parse",
      name: "JSON parsing",
      category: "HTTP",
      status: "fail",
      message: "Response body is not valid JSON.",
      evidence: res.bodyText.slice(0, 400),
      fix: "Return a valid JSON body.",
    });
  }

  return { checks };
}

async function x402ChecksNode(state: PreflightState): Promise<Partial<PreflightState>> {
  const checks = [...state.checks];
  const manifest = [...state.probeManifest];
  const res = state.fetchResponse!;

  checks.push({
    id: "http-402",
    name: "HTTP 402 response",
    category: "x402",
    status: "pass",
    message: "Endpoint returned HTTP 402 for a paid service.",
  });

  const paymentHeader = res.headers["payment-required"] ?? null;
  const { data: inspectResult, entry } = await runTool("inspect_x402", {
    paymentRequiredHeader: paymentHeader,
    targetHostname: state.urlObj!.hostname,
  });

  manifest.push(entry);
  if (inspectResult?.checks) {
    checks.push(...inspectResult.checks);
  }

  return { checks, probeManifest: manifest };
}

async function httpFailureNode(state: PreflightState): Promise<Partial<PreflightState>> {
  const checks = [...state.checks];
  const res = state.fetchResponse!;
  checks.push({
    id: "http-status",
    name: "Expected HTTP status",
    category: "HTTP",
    status: "fail",
    message: `Unexpected HTTP status ${res.status}.`,
    expected: "200 or 402",
    actual: String(res.status),
    fix: "Return 200 with JSON for a free service, or 402 with a PAYMENT-REQUIRED challenge.",
  });
  return { checks };
}

async function aggregateNode(state: PreflightState): Promise<Partial<PreflightState>> {
  const score = computeScore(state.checks);
  const readiness = computeReadiness(score);
  return { score, readiness };
}

async function remediateNode(state: PreflightState): Promise<Partial<PreflightState>> {
  const startMs = Date.now();
  const manifest = [...state.probeManifest];
  const failedChecks = state.checks.filter((c) => c.status === "fail" || (c.status === "warn" && c.fix));
  const fixes: Remediation[] = [];

  const retrievedMap = retrieveFixes(failedChecks);

  for (const check of failedChecks) {
    const retrieved = retrievedMap.get(check.id) || [];
    const bestRetrieval = retrieved[0];

    let structured: Remediation | null = null;
    if (bestRetrieval && process.env.AI_API_KEY) {
      const llmResult = await generateRemediationWithLlm({
        checkId: check.id,
        checkName: check.name,
        checkMessage: check.message,
        retrievedFix: bestRetrieval.fix,
        sources: [bestRetrieval.source],
      });
      if (llmResult) {
        structured = llmResult;
      }
    }

    if (!structured) {
      // Fallback: grounded KB retrieval or static fix
      if (bestRetrieval) {
        structured = {
          checkId: check.id,
          fix: check.fix || bestRetrieval.fix,
          confidence: "high",
          sources: [bestRetrieval.source],
        };
      } else {
        structured = {
          checkId: check.id,
          fix: check.fix || "Review protocol specifications for this failure.",
          confidence: "high",
          sources: ["built-in checks"],
        };
      }
    }

    fixes.push(structured);
  }

  manifest.push({
    tool: "remediate",
    durationMs: Date.now() - startMs,
    startedAt: new Date(startMs).toISOString(),
    status: "ok",
    details: { remediationsCount: fixes.length },
  });

  return { fixes, probeManifest: manifest };
}

// ---------------------------------------------------------------------------
// Build LangGraph StateGraph
// ---------------------------------------------------------------------------

function routeClassifier(state: PreflightState): string {
  if (state.fatalError) return "aggregate";
  if (state.endpointType === "Free A2MCP") return "free_checks";
  if (state.endpointType === "x402") return "x402_checks";
  return "http_failure";
}

function routeSafetyGate(state: PreflightState): string {
  if (state.fatalError) return "aggregate";
  return "fetch";
}

function routeAfterFetch(state: PreflightState): string {
  if (state.fatalError) return "aggregate";
  return "classify";
}

export function buildPreflightGraph() {
  const workflow = new StateGraph(PreflightAnnotation)
    .addNode("validate_input", validateInputNode)
    .addNode("safety_gate", safetyGateNode)
    .addNode("fetch", fetchNode)
    .addNode("classify", classifyNode)
    .addNode("free_checks", freeChecksNode)
    .addNode("x402_checks", x402ChecksNode)
    .addNode("http_failure", httpFailureNode)
    .addNode("aggregate", aggregateNode)
    .addNode("remediate", remediateNode);

  workflow.addEdge(START, "validate_input");
  workflow.addConditionalEdges("validate_input", (state) => (state.fatalError ? "aggregate" : "safety_gate"));
  workflow.addConditionalEdges("safety_gate", routeSafetyGate);
  workflow.addConditionalEdges("fetch", routeAfterFetch);
  workflow.addConditionalEdges("classify", routeClassifier);
  workflow.addEdge("free_checks", "aggregate");
  workflow.addEdge("x402_checks", "aggregate");
  workflow.addEdge("http_failure", "aggregate");
  workflow.addEdge("aggregate", "remediate");
  workflow.addEdge("remediate", END);

  return workflow.compile();
}

export const preflightGraph = buildPreflightGraph();

export async function executeAuditGraph(params: {
  targetUrl: string;
  method?: "GET" | "POST";
  requestBody?: unknown;
}): Promise<AuditReport> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const auditId = `audit_${Math.random().toString(36).slice(2, 10)}`;

  const initialState: PreflightState = {
    targetUrl: params.targetUrl,
    method: params.method || "GET",
    requestBody: params.requestBody,
    urlObj: undefined,
    checks: [],
    endpointType: "Unknown",
    httpStatus: null,
    responseTimeMs: undefined,
    score: 0,
    readiness: "Not Ready",
    fixes: [],
    probeManifest: [],
    auditId,
    startedAt,
    fetchResponse: undefined,
    fatalError: false,
  };

  const finalState = (await preflightGraph.invoke(initialState)) as PreflightState;
  const durationMs = Date.now() - startMs;

  const passed = finalState.checks.filter((c) => c.status === "pass").length;
  const warnings = finalState.checks.filter((c) => c.status === "warn").length;
  const failed = finalState.checks.filter((c) => c.status === "fail").length;

  return {
    auditId,
    targetUrl: params.targetUrl,
    auditedAt: startedAt,
    durationMs,
    httpStatus: finalState.httpStatus,
    endpointType: finalState.endpointType,
    readiness: finalState.readiness,
    score: finalState.score,
    summary: { passed, warnings, failed },
    checks: finalState.checks,
    fixes: finalState.fixes,
    probeManifest: finalState.probeManifest,
    disclaimer:
      "Preflight evaluates documented protocol behavior and independent readiness checks. A passing result does not guarantee marketplace approval.",
  };
}
