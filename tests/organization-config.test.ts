import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  featuresFromPlan,
  resolveOrganizationConfig,
} from "@/convex/shared/organizationConfig";
import { DEFAULT_NOVEND_EXPERIENCE } from "@/convex/shared/experience";

const ORG_ID = "org_test" as Id<"organizations">;

describe("resolveOrganizationConfig", () => {
  it("falls unknown plans through to basic entitlements", () => {
    const config = resolveOrganizationConfig({
      organization: { _id: ORG_ID },
      planKey: "standard",
    });
    expect(config.commercial.planKey).toBe("basic");
    expect(config.features["reports.pdf"]).toBe(false);
    expect(config.features["inventory.wholesale"]).toBe(false);
    expect(config.experience).toEqual(DEFAULT_NOVEND_EXPERIENCE);
  });

  it("keeps lifetime plan resolution and advanced features", () => {
    const config = resolveOrganizationConfig({
      organization: { _id: ORG_ID },
      planKey: "lifetime",
    });
    expect(config.commercial.planKey).toBe("lifetime");
    expect(config.features["reports.pdf"]).toBe(true);
    expect(config.features["reports.xlsx"]).toBe(true);
    expect(config.features["staff.compensation"]).toBe(true);
    expect(config.features.customerDisplay).toBe(true);
    expect(config.features["inventory.wholesale"]).toBe(true);
    expect(config.commercial.canSelfServe).toBe(false);
  });

  it("lets an organization feature override disable a plan-enabled capability", () => {
    const config = resolveOrganizationConfig({
      organization: {
        _id: ORG_ID,
        featureOverrides: [{ feature: "reports.pdf", value: "disabled" }],
      },
      planKey: "pro",
    });
    expect(featuresFromPlan("pro")["reports.pdf"]).toBe(true);
    expect(config.features["reports.pdf"]).toBe(false);
    expect(config.features["reports.xlsx"]).toBe(true);
  });

  it("lets inherit fall through to template then plan", () => {
    const config = resolveOrganizationConfig({
      organization: {
        _id: ORG_ID,
        featureOverrides: [
          { feature: "reports.pdf", value: "inherit" },
          { feature: "customerDisplay", value: "disabled" },
        ],
      },
      planKey: "basic",
      template: {
        values: [
          { feature: "reports.pdf", enabled: true },
          { feature: "customerDisplay", enabled: true },
        ],
      },
    });
    expect(config.features["reports.pdf"]).toBe(true);
    expect(config.features.customerDisplay).toBe(false);
  });

  it("lets template beat plan, and org enabled beat a disabled template", () => {
    const config = resolveOrganizationConfig({
      organization: {
        _id: ORG_ID,
        featureOverrides: [{ feature: "inventory.wholesale", value: "enabled" }],
      },
      planKey: "basic",
      template: {
        values: [{ feature: "inventory.wholesale", enabled: false }],
      },
    });
    expect(featuresFromPlan("basic")["inventory.wholesale"]).toBe(false);
    expect(config.features["inventory.wholesale"]).toBe(true);
  });

  it("keeps products.editStock off by default and allow an org ops override", () => {
    expect(featuresFromPlan("basic")["products.editStock"]).toBe(false);
    expect(featuresFromPlan("enterprise")["products.editStock"]).toBe(false);
    const enabled = resolveOrganizationConfig({
      organization: {
        _id: ORG_ID,
        featureOverrides: [{ feature: "products.editStock", value: "enabled" }],
      },
      planKey: "basic",
    });
    expect(enabled.features["products.editStock"]).toBe(true);
  });

  it("hides billing features when billingVisibility is hidden", () => {
    const config = resolveOrganizationConfig({
      organization: {
        _id: ORG_ID,
        billingVisibility: "hidden",
      },
      planKey: "pro",
    });
    expect(config.billingVisibility).toBe("hidden");
    expect(config.features["billing.view"]).toBe(false);
    expect(config.features["billing.selfServeCheckout"]).toBe(false);
    expect(config.commercial.canSelfServe).toBe(false);
  });
});
