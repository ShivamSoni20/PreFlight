import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/demo/broken-x402")({
  server: {
    handlers: {
      GET: async () => Response.json({
        error: "Payment required",
        demo: "This intentionally broken demonstration omits PAYMENT-REQUIRED.",
      }, { status: 402 }),
    },
  },
});
