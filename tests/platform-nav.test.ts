import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLATFORM_NAV_ACCORDION_GROUP,
  findPlatformNavGroupForPath,
  isPlatformNavAccordionGroup,
  PLATFORM_NAV_ACCORDION_GROUP_IDS,
  platformNavItemActive,
} from "@/config/platform-navigation";

describe("platform nav accordion", () => {
  it("defaults to analytics", () => {
    expect(DEFAULT_PLATFORM_NAV_ACCORDION_GROUP).toBe("analytics");
  });

  it("treats overview as fixed, not accordion", () => {
    expect(isPlatformNavAccordionGroup("overview")).toBe(false);
    expect(isPlatformNavAccordionGroup("tenants")).toBe(true);
  });

  it("lists collapsible SaaS sections", () => {
    expect(PLATFORM_NAV_ACCORDION_GROUP_IDS).toEqual(["analytics", "tenants"]);
  });

  it("matches overview exactly", () => {
    expect(
      platformNavItemActive("/platform", {
        title: "Dashboard",
        href: "/platform",
        icon: (() => null) as never,
        exact: true,
      }),
    ).toBe(true);
    expect(
      platformNavItemActive("/platform/organizations", {
        title: "Dashboard",
        href: "/platform",
        icon: (() => null) as never,
        exact: true,
      }),
    ).toBe(false);
  });

  it("resolves the deepest matching group", () => {
    expect(findPlatformNavGroupForPath("/platform")).toBe("overview");
    expect(findPlatformNavGroupForPath("/platform/organizations")).toBe("tenants");
    expect(findPlatformNavGroupForPath("/platform/organizations/abc")).toBe("tenants");
    expect(findPlatformNavGroupForPath("/platform/revenue")).toBe("analytics");
    expect(findPlatformNavGroupForPath("/platform/releases")).toBe("tenants");
    expect(findPlatformNavGroupForPath("/platform/costs")).toBe("tenants");
    expect(findPlatformNavGroupForPath("/platform/activity")).toBe("analytics");
  });
});
