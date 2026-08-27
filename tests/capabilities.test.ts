import { describe, expect, it } from "vitest";
import { planCapabilities } from "@/convex/shared/capabilities";
import { resolvePlan } from "@/convex/shared/plans";

describe("planCapabilities", () => {
  it("gives every commercial plan CSV import/export without inventing prices", () => {
    for (const key of ["basic", "pro", "enterprise", "lifetime"] as const) {
      const caps = planCapabilities(key);
      expect(caps.canImportProducts).toBe(true);
      expect(caps.canExportCsv).toBe(true);
      expect(caps.canExportJson).toBe(true);
      expect(caps.canExportReports).toBe(true);
    }
  });

  it("reserves Excel and PDF for Pro rank and above", () => {
    expect(planCapabilities("basic").canExportXlsx).toBe(false);
    expect(planCapabilities("basic").canExportPdf).toBe(false);
    expect(planCapabilities("pro").canExportXlsx).toBe(true);
    expect(planCapabilities("enterprise").canExportPdf).toBe(true);
    expect(planCapabilities("lifetime").canAdvancedAnalytics).toBe(true);
  });

  it("derives max import rows from the product limit", () => {
    expect(planCapabilities("basic").maxImportRows).toBe(resolvePlan("basic").limits.products);
    expect(planCapabilities("pro").maxImportRows).toBe(resolvePlan("pro").limits.products);
    expect(planCapabilities("enterprise").maxImportRows).toBe(10_000);
  });
});
