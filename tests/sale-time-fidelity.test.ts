import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("sale time fidelity contracts", () => {
  it("outbox complete_sale carries till completedAt into Convex", () => {
    const types = readFileSync(resolve(process.cwd(), "lib/offline/types.ts"), "utf8");
    const repo = readFileSync(resolve(process.cwd(), "lib/offline/sales-repository.ts"), "utf8");
    const sync = readFileSync(resolve(process.cwd(), "lib/offline/sync-engine.ts"), "utf8");
    const sales = readFileSync(resolve(process.cwd(), "convex/sales.ts"), "utf8");
    expect(types).toContain("completedAt: number");
    expect(repo).toContain("completedAt,");
    expect(sync).toContain("clientCompletedAt: payload.completedAt ?? localSale?.completedAt");
    expect(sales).toContain("clientCompletedAt");
    expect(sales).toContain("syncedAt");
  });

  it("Cap opens Android DATE_SETTINGS for till clock fixes", () => {
    const cap = readFileSync(
      resolve(process.cwd(), "packages/hardware/src/adapters/cap-services.ts"),
      "utf8",
    );
    expect(cap).toContain("openDateTimeSettings");
    expect(cap).toContain("android.settings.DATE_SETTINGS");
  });

  it("Sales checkout shows till clock always and Fix CTA offline-only", () => {
    const view = readFileSync(
      resolve(process.cwd(), "features/sales/components/sales-view.tsx"),
      "utf8",
    );
    const clock = readFileSync(
      resolve(process.cwd(), "features/sales/components/sales-till-clock.tsx"),
      "utf8",
    );
    expect(view).toContain("<SalesTillClock showFixCta={!online} />");
    expect(clock).toContain("Till clock");
    expect(clock).toContain("Fix date & time");
    expect(clock).toContain("openDateTimeSettings");
  });
});
