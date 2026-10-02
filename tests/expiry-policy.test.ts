import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPIRY_ALERT_DAYS,
  DEFAULT_EXPIRY_POLICY,
  parseExpiryPolicy,
  resolveExpiryAlertDays,
} from "@/convex/shared/expiryPolicy";
import { productExpiryAlertDays } from "@/convex/shared/lots";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("expiry policy", () => {
  it("defaults to 30 days and accepts a valid org default", () => {
    expect(parseExpiryPolicy(undefined)).toEqual(DEFAULT_EXPIRY_POLICY);
    expect(parseExpiryPolicy('{"defaultAlertDays":14}')).toEqual({ defaultAlertDays: 14 });
    expect(parseExpiryPolicy("{not-json}")).toEqual(DEFAULT_EXPIRY_POLICY);
  });

  it("resolves product override over org default", () => {
    expect(resolveExpiryAlertDays({}, 14)).toBe(14);
    expect(resolveExpiryAlertDays({ expiryAlertDays: null }, 14)).toBe(14);
    expect(resolveExpiryAlertDays({ expiryAlertDays: 7 }, 14)).toBe(7);
    expect(productExpiryAlertDays({ expiryAlertDays: undefined }, 21)).toBe(21);
    expect(productExpiryAlertDays({ expiryAlertDays: 5 }, 21)).toBe(5);
    expect(resolveExpiryAlertDays({}, undefined as unknown as number)).toBe(
      DEFAULT_EXPIRY_ALERT_DAYS,
    );
  });

  it("exposes settings get/update and product null override", () => {
    const settings = readFileSync(resolve(process.cwd(), "convex/settings.ts"), "utf8");
    expect(settings).toContain("getExpiryPolicy");
    expect(settings).toContain("updateExpiryPolicy");
    expect(settings).toContain("EXPIRY_POLICY_SETTINGS_KEY");
    const policy = readFileSync(resolve(process.cwd(), "convex/shared/expiryPolicy.ts"), "utf8");
    expect(policy).toContain('inventory.expiry');
    const products = readFileSync(resolve(process.cwd(), "convex/products.ts"), "utf8");
    expect(products).toContain("v.optional(v.union(v.number(), v.null()))");
    expect(products).toContain("expiryAlertDaysOverride");
    const form = readFileSync(
      resolve(process.cwd(), "features/products/components/product-form-dialog.tsx"),
      "utf8",
    );
    expect(form).toContain("expiryAlertUseOrgDefault");
    expect(form).toContain("Use organization default");
    const card = readFileSync(
      resolve(process.cwd(), "features/settings/components/expiry-alert-settings-card.tsx"),
      "utf8",
    );
    expect(card).toContain("Default alert days");
  });
});
