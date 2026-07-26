import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/demo/free")({
  server: {
    handlers: {
      GET: async () => Response.json({
        status: "ok",
        service: "ProbeKit free A2MCP demonstration",
        result: { message: "This endpoint returns valid JSON without payment." },
      }),
    },
  },
});
