import { describe, expect, it } from "vitest";
import { isMarketingPath } from "@/lib/marketing-routes";

describe("isMarketingPath", () => {
  it("treats pricing and product marketing pages as public", () => {
    expect(isMarketingPath("/pricing")).toBe(true);
    expect(isMarketingPath("/pricing#lifetime")).toBe(true);
    expect(isMarketingPath("/product")).toBe(true);
    expect(isMarketingPath("/product/")).toBe(true);
    expect(isMarketingPath("/product/pos")).toBe(true);
    expect(isMarketingPath("/product/offline-sync")).toBe(true);
  });

  it("does not treat the authenticated products catalog as marketing", () => {
    expect(isMarketingPath("/products")).toBe(false);
    expect(isMarketingPath("/products/abc")).toBe(false);
  });

  it("keeps core marketing and legal paths public", () => {
    expect(isMarketingPath("/")).toBe(true);
    expect(isMarketingPath("/download")).toBe(true);
    expect(isMarketingPath("/docs/help")).toBe(true);
    expect(isMarketingPath("/privacy")).toBe(true);
  });
});
