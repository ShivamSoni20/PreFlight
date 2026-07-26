import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => Response.json({
        status: "ok",
        service: "ASP ProbeKit",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
      }, { headers: { "cache-control": "no-store" } }),
    },
  },
});
