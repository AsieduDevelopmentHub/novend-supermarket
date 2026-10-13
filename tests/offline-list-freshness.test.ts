import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Dexie-first business lists", () => {
  it("skips live Convex list subscriptions when the mirror already has catalog rows", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/offline/freshness.ts"), "utf8");
    expect(source).toContain("mirrorHasCatalog");
    expect(source).toContain("shouldUseRemoteBusinessLists");
    expect(source).toMatch(/if \(await mirrorHasCatalog\(\)\) return false/);
    expect(source).toContain("SNAPSHOT_PULL_TTL_MS = 60 * 60 * 1000");
    expect(source).toContain("AUTO_SYNC_INTERVAL_MS = 60 * 60 * 1000");
  });

  it("all mirrored admin lists respect the Dexie serveLocal gate", () => {
    const source = readFileSync(resolve(process.cwd(), "hooks/use-offline-lists.ts"), "utf8");
    expect(source).toMatch(
      /api\.categories\.list,\s*online && ready && !serveLocal \? \{\} : "skip"/,
    );
    expect(source).toMatch(
      /api\.branches\.list,\s*enabled && online && ready && !serveLocal/,
    );
    expect(source).toMatch(
      /api\.users\.list,\s*enabled && online && ready && !serveLocal/,
    );
    expect(source).toMatch(
      /api\.returns\.list,\s*online && ready && !serveLocal/,
    );
  });

  it("warm cashier dashboards stay Dexie-first; admin/manager use live summary online", () => {
    const source = readFileSync(resolve(process.cwd(), "hooks/use-dashboard-data.ts"), "utf8");
    const gate = readFileSync(resolve(process.cwd(), "hooks/use-business-data-gate.ts"), "utf8");
    // PeriodRange alone must not force remote — use showOps (role), not range.
    expect(source).toContain("(!serveLocal || showOps)");
    expect(source).not.toContain("(!serveLocal || range)");
    expect(source).toContain("subscribeReplicaChanged(loadLocal)");
    expect(source).toContain("buildLocalDashboardSummary");
    // hospitalityOps shares the same gate — no always-on cold auth path.
    const hospitalityArgs = source
      .split("api.dashboard.hospitalityOps,")[1]
      ?.split(");")[0];
    expect(hospitalityArgs).toContain("shouldQueryRemote");
    expect(hospitalityArgs).not.toContain("online && isAuthenticated");
    // Must not freeze on the first warm cache paint while online.
    expect(source).not.toContain("if (online) return;");
    // Prefer Dexie until the catalog probe finishes (avoid cold-query flash).
    expect(gate).toContain("serveLocal: true");
  });

  it("does not force a full snapshot on ordinary reconnect", () => {
    const provider = readFileSync(
      resolve(process.cwd(), "providers/offline-provider.tsx"),
      "utf8",
    );
    const reconnect = provider.split("const onOnline = () => {")[1]?.split("};")[0];
    expect(reconnect).toContain("pullSnapshot()");
    expect(reconnect).not.toContain("force: true");
  });

  it("batches presence and telemetry writes", () => {
    const layout = readFileSync(
      resolve(process.cwd(), "app/(app)/app-layout-client.tsx"),
      "utf8",
    );
    const devices = readFileSync(
      resolve(process.cwd(), "hooks/use-device-activation.ts"),
      "utf8",
    );
    const telemetry = readFileSync(
      resolve(process.cwd(), "providers/telemetry-provider.tsx"),
      "utf8",
    );
    expect(layout).toContain("HEARTBEAT_MS = 15 * 60_000");
    expect(devices).toContain("TOUCH_INTERVAL_MS = 30 * 60 * 1000");
    expect(telemetry).toContain("TELEMETRY_FLUSH_INTERVAL_MS = 5 * 60 * 1000");
    expect(telemetry).toContain("TELEMETRY_IMMEDIATE_BATCH_SIZE = 20");
    expect(telemetry).toContain("SYNC_HEALTH_SIGNATURE_KEY");
  });

  it("dining and hotel product pickers do not subscribe to listProducts directly", () => {
    const dining = readFileSync(
      resolve(process.cwd(), "features/dining/components/dining-floor-view.tsx"),
      "utf8",
    );
    const hotel = readFileSync(
      resolve(process.cwd(), "features/hotel/components/rooms-board-view.tsx"),
      "utf8",
    );
    expect(dining).not.toContain("api.products.listProducts");
    expect(hotel).not.toContain("api.products.listProducts");
    expect(hotel).not.toContain("api.customers.list");
    expect(dining).toContain("useProductsList");
    expect(hotel).toContain("useProductsList");
    expect(hotel).toContain("useCustomersList");
  });
});

describe("Vercel production-only deploys", () => {
  it("disables git deployments for every branch except main", () => {
    const raw = readFileSync(resolve(process.cwd(), "vercel.json"), "utf8");
    const config = JSON.parse(raw) as {
      git?: { deploymentEnabled?: Record<string, boolean> };
    };
    expect(config.git?.deploymentEnabled?.["*"]).toBe(false);
    expect(config.git?.deploymentEnabled?.main).toBe(true);
  });
});
