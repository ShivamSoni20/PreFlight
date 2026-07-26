import { createFileRoute } from "@tanstack/react-router";

const challenge = {
  x402Version: 2,
  resource: {
    url: "https://example.com/api/demo/valid-x402",
    description: "Structurally valid ProbeKit x402 demonstration",
    mimeType: "application/json",
  },
  accepts: [{
    scheme: "exact",
    network: "eip155:196",
    asset: "0x1111111111111111111111111111111111111111",
    amount: "10000",
    payTo: "0x2222222222222222222222222222222222222222",
    maxTimeoutSeconds: 300,
  }],
};

export const Route = createFileRoute("/api/demo/valid-x402")({
  server: {
    handlers: {
      GET: async () => Response.json({
        error: "Payment required",
        demo: "Demonstration challenge only. No payment settlement is performed.",
      }, {
        status: 402,
        headers: { "payment-required": btoa(JSON.stringify(challenge)) },
      }),
    },
  },
});
