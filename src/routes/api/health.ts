import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => Response.json({
        status: "ok",
        service: "Preflight",
        version: "2.0.0",
        timestamp: new Date().toISOString(),
      }, { headers: { "cache-control": "no-store" } }),
    },
  },
});
