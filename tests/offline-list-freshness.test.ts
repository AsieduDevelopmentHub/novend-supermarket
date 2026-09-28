import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Dexie-first business lists", () => {
  it("skips live Convex list subscriptions when the mirror already has catalog rows", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/offline/freshness.ts"), "utf8");
    expect(source).toContain("mirrorHasCatalog");
    expect(source).toContain("shouldUseRemoteBusinessLists");
    expect(source).toMatch(/if \(await mirrorHasCatalog\(\)\) return false/);
    expect(source).toContain("SNAPSHOT_PULL_TTL_MS = 20 * 60 * 1000");
  });

  it("categories list respects the Dexie serveLocal gate", () => {
    const source = readFileSync(resolve(process.cwd(), "hooks/use-offline-lists.ts"), "utf8");
    expect(source).toMatch(
      /api\.categories\.list,\s*online && ready && !serveLocal \? \{\} : "skip"/,
    );
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
