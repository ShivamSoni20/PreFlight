import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/demo/valid-x402")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const challenge = {
          x402Version: 2,
          resource: {
            url: new URL("/api/demo/valid-x402", request.url).toString(),
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
        return Response.json({
          error: "Payment required",
          demo: "Demonstration challenge only. No payment settlement is performed.",
        }, {
          status: 402,
          headers: { "payment-required": btoa(JSON.stringify(challenge)) },
        });
      },
    },
  },
});
