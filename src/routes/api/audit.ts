import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { executeAuditGraph } from "@/lib/preflight-graph";

const MAX_REQUEST_BYTES = 32 * 1024;

const requestSchema = z.object({
  targetUrl: z.string().trim().min(1, "targetUrl is required.").max(2048),
  method: z.enum(["GET", "POST"]).default("GET"),
  requestBody: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const Route = createFileRoute("/api/audit")({
  server: {
    handlers: {
      GET: async () => Response.json({
        error: "Method not allowed.",
        message: "Preflight audits endpoints through POST /api/audit.",
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
        if (contentLength > MAX_REQUEST_BYTES) {
          return Response.json(
            { error: "Payload too large.", message: `Request body must be under ${MAX_REQUEST_BYTES} bytes.` },
            { status: 413, headers: { "cache-control": "no-store" } }
          );
        }

        let bodyJson: unknown;
        try {
          const raw = await request.text();
          if (raw.length > MAX_REQUEST_BYTES) {
            return Response.json(
              { error: "Payload too large.", message: `Request body must be under ${MAX_REQUEST_BYTES} bytes.` },
              { status: 413, headers: { "cache-control": "no-store" } }
            );
          }
          bodyJson = raw ? JSON.parse(raw) : {};
        } catch {
          return Response.json(
            { error: "Invalid JSON.", message: "Request body must be valid JSON." },
            { status: 400, headers: { "cache-control": "no-store" } }
          );
        }

        const parseResult = requestSchema.safeParse(bodyJson);
        if (!parseResult.success) {
          return Response.json(
            {
              error: "Bad request.",
              message: parseResult.error.issues.map((i) => i.message).join(" "),
              issues: parseResult.error.issues,
            },
            { status: 400, headers: { "cache-control": "no-store" } }
          );
        }

        const { targetUrl, method, requestBody } = parseResult.data;
        const report = await executeAuditGraph({
          targetUrl,
          method,
          requestBody,
        });

        return Response.json(report, {
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
