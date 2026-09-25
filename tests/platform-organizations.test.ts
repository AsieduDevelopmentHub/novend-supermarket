import { describe, expect, it } from "vitest";
import { countOrganizationsByCommercialStatus } from "@/convex/shared/platformOrganizations";

describe("countOrganizationsByCommercialStatus", () => {
  it("excludes test orgs from active/trial KPIs", () => {
    const counts = countOrganizationsByCommercialStatus([
      { status: "active", isTestOrganization: false },
      { status: "trial", isTestOrganization: false },
      { status: "active", isTestOrganization: true },
      { status: "trial", isTestOrganization: true },
    ]);
    expect(counts.total).toBe(4);
    expect(counts.commercialCount).toBe(2);
    expect(counts.testCount).toBe(2);
    expect(counts.active).toBe(1);
    expect(counts.trial).toBe(1);
  });
});
