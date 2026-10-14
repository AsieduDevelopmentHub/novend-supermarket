import { describe, expect, it } from "vitest";
import {
  isBillingHidden,
  navGroupsForRole,
  pathAllowedForRole,
} from "@/config/navigation";
import { defaultLicenseEntitlements, featureEnabled } from "@/convex/shared/licensing";
import { featuresFromPlan } from "@/convex/shared/organizationConfig";
import { DEFAULT_NOVEND_EXPERIENCE } from "@/convex/shared/experience";
import { requiredFeatureForOutbox } from "@/lib/offline/license-guard";

describe("navigation feature gates", () => {
  it("never shows wholesale or branches in Milliesmart navigation", () => {
    const features = { ...featuresFromPlan("pro"), "inventory.wholesale": true, "branches.multiBranch": true };
    const groups = navGroupsForRole("administrator", [], { features });
    const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).not.toContain("/wholesale");
    expect(hrefs).not.toContain("/branches");
  });

  it("denies billing deep-links when billingVisibility is hidden", () => {
    const features = defaultLicenseEntitlements("pro").features;
    expect(
      pathAllowedForRole("/settings?section=billing", "administrator", [], {
        features,
        billingVisibility: "hidden",
      }),
    ).toBe(false);
    expect(isBillingHidden({ features, billingVisibility: "hidden" })).toBe(true);
  });

  it("denies billing when billing.view is false", () => {
    const features = {
      ...defaultLicenseEntitlements("pro").features,
      "billing.view": false,
    };
    expect(isBillingHidden({ features, billingVisibility: "visible" })).toBe(true);
  });
});

describe("licence entitlement helpers", () => {
  it("defaults experience tokens to Novend brand", () => {
    const entitlements = defaultLicenseEntitlements("basic");
    expect(entitlements.experience).toEqual(DEFAULT_NOVEND_EXPERIENCE);
    expect(entitlements.billingVisibility).toBe("visible");
    expect(entitlements.commercial.planKey).toBe("basic");
  });

  it("reports featureEnabled from a features record", () => {
    const features = featuresFromPlan("pro");
    expect(featureEnabled(features, "reports.pdf")).toBe(features["reports.pdf"]);
    expect(featureEnabled(undefined, "billing.view")).toBe(true);
    expect(featureEnabled(features, "products.editStock")).toBe(false);
    expect(featureEnabled(undefined, "products.editStock")).toBe(false);
  });

  it("maps wholesale outbox ops to inventory.wholesale", () => {
    expect(requiredFeatureForOutbox("record_wholesale_purchase")).toBe("inventory.wholesale");
    expect(requiredFeatureForOutbox("wholesale_transfer")).toBe("inventory.wholesale");
    expect(requiredFeatureForOutbox("upsert_branch")).toBe("branches.multiBranch");
    expect(requiredFeatureForOutbox("complete_sale")).toBeNull();
  });
});
