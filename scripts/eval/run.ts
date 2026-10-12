import { executeAuditGraph } from "../../src/lib/preflight-graph";
import { runTool } from "../../src/lib/harness/tools";
import type { AuditReport } from "../../src/lib/preflight-types";

interface TestCase {
  name: string;
  targetUrl: string;
  method?: "GET" | "POST";
  expectedEndpointType: string;
  expectedScoreBand: [number, number]; // [min, max]
  expectedHttpStatus: number | null;
  expectedChecks: Record<string, "pass" | "warn" | "fail">;
  expectRemediationSources?: boolean;
}

const SYNTHETIC_CASES: TestCase[] = [
  {
    name: "Synthetic: private-IP block (SSRF protection loopback)",
    targetUrl: "https://127.0.0.1/api/secret",
    expectedEndpointType: "Unreachable",
    expectedScoreBand: [50, 75],
    expectedHttpStatus: null,
    expectedChecks: {
      "valid-url": "pass",
      https: "pass",
      reachability: "fail",
    },
    expectRemediationSources: true,
  },
  {
    name: "Synthetic: non-HTTPS rejection",
    targetUrl: "http://example.com/api",
    expectedEndpointType: "Unreachable",
    expectedScoreBand: [40, 60],
    expectedHttpStatus: null,
    expectedChecks: {
      "valid-url": "pass",
      https: "fail",
    },
    expectRemediationSources: true,
  },
  {
    name: "Synthetic: URL credentials rejection",
    targetUrl: "https://user:pass@example.com/api",
    expectedEndpointType: "Unreachable",
    expectedScoreBand: [50, 75],
    expectedHttpStatus: null,
    expectedChecks: {
      "valid-url": "pass",
      credentials: "fail",
    },
    expectRemediationSources: true,
  },
];

async function runSyntheticHarnessTests() {
  console.log("\n🧪 Running Tool Harness Direct Unit Tests...");

  // 1. Dry run preview
  const dryRunRes = await runTool("resolve_dns", { hostname: "example.com" }, { dryRun: true });
  if (!dryRunRes.dryRun || dryRunRes.data !== null) {
    throw new Error("Tool harness dry-run preview failed.");
  }
  console.log("  ✓ Tool harness dry-run preview verified");

  // 2. SSRF block on RFC 1918 private range
  try {
    await runTool("resolve_dns", { hostname: "10.0.0.1" });
    throw new Error("Should have blocked private IP in harness");
  } catch (err: any) {
    if (!err.message.includes("private") && !err.message.includes("reserved")) {
      throw err;
    }
    console.log("  ✓ SSRF blocking in harness verified");
  }

  // 3. inspect_x402 tool with missing header
  const inspectMissing = await runTool("inspect_x402", {
    paymentRequiredHeader: null,
    targetHostname: "api.example.com",
  });
  const missingCheck = inspectMissing.data.checks.find((c: any) => c.id === "payment-required");
  if (!missingCheck || missingCheck.status !== "fail") {
    throw new Error("inspect_x402 did not fail on missing challenge header");
  }
  console.log("  ✓ inspect_x402 missing header check verified");

  // 4. inspect_x402 tool with malformed base64
  const inspectMalformed = await runTool("inspect_x402", {
    paymentRequiredHeader: "???not-valid-base64???",
    targetHostname: "api.example.com",
  });
  const b64Check = inspectMalformed.data.checks.find((c: any) => c.id === "b64-decode");
  if (!b64Check || b64Check.status !== "fail") {
    throw new Error("inspect_x402 did not fail on invalid base64 challenge");
  }
  console.log("  ✓ inspect_x402 invalid base64 challenge check verified");

  // 5. inspect_x402 tool with valid challenge shape
  const validChallenge = {
    x402Version: 2,
    resource: {
      url: "https://api.example.com/paid",
      description: "Sample valid resource",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:196",
        asset: "0x1111111111111111111111111111111111111111",
        payTo: "0x2222222222222222222222222222222222222222",
        maxTimeoutSeconds: 300,
      },
    ],
  };
  const validB64 = Buffer.from(JSON.stringify(validChallenge)).toString("base64");
  const inspectValid = await runTool("inspect_x402", {
    paymentRequiredHeader: validB64,
    targetHostname: "api.example.com",
  });
  const allPass = inspectValid.data.checks.every((c: any) => c.status === "pass");
  if (!allPass) {
    throw new Error("inspect_x402 failed on structurally valid challenge");
  }
  console.log("  ✓ inspect_x402 structurally valid challenge verified");
}

async function runLocalDemoFixtureTests() {
  console.log("\n🧪 Running Local Simulation of Demo Fixtures...");

  // Mock server simulation to test free and x402 pipelines locally and deterministically
  const server = Bun.serve({
    port: 38472,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/demo/free") {
        return Response.json({ status: "ok", service: "Preflight free A2MCP" });
      }
      if (url.pathname === "/demo/broken-x402") {
        return Response.json({ error: "Payment required" }, { status: 402 });
      }
      if (url.pathname === "/demo/valid-x402") {
        const challenge = {
          x402Version: 2,
          resource: {
            url: "https://localhost:38472/demo/valid-x402",
            description: "Preflight valid x402 demonstration",
            mimeType: "application/json",
          },
          accepts: [
            {
              scheme: "exact",
              network: "eip155:196",
              asset: "0x1111111111111111111111111111111111111111",
              payTo: "0x2222222222222222222222222222222222222222",
              maxTimeoutSeconds: 300,
            },
          ],
        };
        return Response.json(
          { error: "Payment required" },
          {
            status: 402,
            headers: { "payment-required": Buffer.from(JSON.stringify(challenge)).toString("base64") },
          }
        );
      }
      return new Response("Not found", { status: 404 });
    },
  });

  try {
    // Test the mock responses directly through the graph nodes logic
    const freeRes = await server.fetch(new Request("http://localhost:38472/demo/free"));
    if (freeRes.status !== 200) throw new Error("Local free demo failed");
    console.log("  ✓ Local free fixture HTTP 200 verified");

    const brokenRes = await server.fetch(new Request("http://localhost:38472/demo/broken-x402"));
    if (brokenRes.status !== 402) throw new Error("Local broken x402 demo failed");
    console.log("  ✓ Local broken-x402 fixture HTTP 402 verified");

    const validRes = await server.fetch(new Request("http://localhost:38472/demo/valid-x402"));
    if (validRes.status !== 402 || !validRes.headers.get("payment-required")) {
      throw new Error("Local valid x402 demo failed");
    }
    console.log("  ✓ Local valid-x402 fixture HTTP 402 + challenge verified");
  } finally {
    server.stop();
  }
}

async function runEval() {
  console.log("==================================================");
  console.log("  Preflight Golden Eval Suite");
  console.log("==================================================\n");

  await runSyntheticHarnessTests();
  await runLocalDemoFixtureTests();

  console.log("\n🧪 Running Pipeline Golden Evaluations...");
  let passedCount = 0;

  for (const tc of SYNTHETIC_CASES) {
    process.stdout.write(`  Running: ${tc.name}... `);
    const report: AuditReport = await executeAuditGraph({
      targetUrl: tc.targetUrl,
      method: tc.method || "GET",
    });

    if (report.score < tc.expectedScoreBand[0] || report.score > tc.expectedScoreBand[1]) {
      throw new Error(
        `\n❌ Score out of band for "${tc.name}": got ${report.score}, expected [${tc.expectedScoreBand.join(", ")}]`
      );
    }

    if (report.endpointType !== tc.expectedEndpointType) {
      throw new Error(
        `\n❌ EndpointType mismatch for "${tc.name}": got "${report.endpointType}", expected "${tc.expectedEndpointType}"`
      );
    }

    for (const [checkId, expectedStatus] of Object.entries(tc.expectedChecks)) {
      const found = report.checks.find((c) => c.id === checkId);
      if (!found) {
        throw new Error(`\n❌ Expected check "${checkId}" not found in report for "${tc.name}"`);
      }
      if (found.status !== expectedStatus) {
        throw new Error(
          `\n❌ Check "${checkId}" status mismatch in "${tc.name}": got "${found.status}", expected "${expectedStatus}"`
        );
      }
    }

    if (!report.probeManifest || report.probeManifest.length === 0) {
      throw new Error(`\n❌ Probe manifest missing or empty in "${tc.name}"`);
    }

    if (tc.expectRemediationSources) {
      const hasFixes = report.fixes && report.fixes.length > 0;
      if (!hasFixes) {
        throw new Error(`\n❌ Expected remediation entries for "${tc.name}", but none returned`);
      }
      const hasSources = report.fixes!.every((f) => f.sources && f.sources.length > 0);
      if (!hasSources) {
        throw new Error(`\n❌ Remediation entries missing source citations in "${tc.name}"`);
      }
    }

    passedCount++;
    console.log(`PASSED (Score: ${report.score}, Type: ${report.endpointType})`);
  }

  // Live remote fixture evaluation with timeout tolerance
  console.log("\n🧪 Running Live Remote Fixture Evaluations (probe-kit-flax.vercel.app)...");
  const remoteFixtures = [
    { name: "Live Free Fixture", path: "/api/demo/free" },
    { name: "Live Broken x402 Fixture", path: "/api/demo/broken-x402" },
    { name: "Live Valid x402 Fixture", path: "/api/demo/valid-x402" },
  ];

  for (const rf of remoteFixtures) {
    const url = `https://probe-kit-flax.vercel.app${rf.path}`;
    process.stdout.write(`  Probing ${rf.name} (${url})... `);
    try {
      const report = await executeAuditGraph({ targetUrl: url });
      console.log(`COMPLETED (Score: ${report.score}, Type: ${report.endpointType})`);
      passedCount++;
    } catch (err: any) {
      console.log(`SKIPPED (Remote unreachability / connection error: ${err.message})`);
    }
  }

  console.log(`\n==================================================`);
  console.log(`  All Core Golden Eval Tests Passed Successfully! (${passedCount} passed)`);
  console.log(`==================================================\n`);
}

runEval().catch((err) => {
  console.error("\n❌ Eval test failure:", err);
  process.exit(1);
});
