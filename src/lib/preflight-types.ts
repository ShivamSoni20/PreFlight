export type CheckStatus = "pass" | "warn" | "fail" | "info";
export type CheckCategory = "Connectivity" | "HTTP" | "x402" | "X Layer";

export interface AuditCheck {
  id: string;
  name: string;
  category: CheckCategory;
  status: CheckStatus;
  message: string;
  evidence?: string;
  expected?: string;
  actual?: string;
  fix?: string;
}

export type EndpointType = "Free A2MCP" | "x402" | "Unknown" | "Unreachable";
export type Readiness = "Protocol Ready" | "Almost Ready" | "Needs Fixes" | "Not Ready";

export interface Remediation {
  checkId: string;
  fix: string;
  confidence: "high" | "medium" | "low";
  sources: string[];
}

export interface ProbeManifestEntry {
  tool: string;
  durationMs: number;
  startedAt: string;
  status?: "ok" | "error" | "budget-exceeded";
  details?: Record<string, unknown>;
}

export interface AuditReport {
  auditId: string;
  targetUrl: string;
  auditedAt: string;
  durationMs: number;
  httpStatus: number | null;
  endpointType: EndpointType;
  readiness: Readiness;
  score: number;
  summary: { passed: number; warnings: number; failed: number };
  checks: AuditCheck[];
  disclaimer: string;
  probeManifest?: ProbeManifestEntry[];
  fixes?: Remediation[];
}

export interface AuditRequest {
  targetUrl: string;
  method: "GET" | "POST";
  requestBody?: unknown;
}
