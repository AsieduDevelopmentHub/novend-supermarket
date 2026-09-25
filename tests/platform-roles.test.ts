import { describe, expect, it } from "vitest";
import {
  platformAdminHasPermission,
  permissionsForRole,
  resolvePlatformRole,
} from "@/convex/shared/platformRoles";
import { platformNavGroupsForPermissions } from "@/config/platform-navigation";

describe("platformRoles", () => {
  it("treats legacy rows without role as owner", () => {
    expect(resolvePlatformRole({})).toBe("owner");
    expect(resolvePlatformRole({ role: "analyst" })).toBe("analyst");
  });

  it("gives owners staff.manage and analysts read-only org access", () => {
    expect(permissionsForRole("owner").has("staff.manage")).toBe(true);
    expect(permissionsForRole("operator").has("staff.manage")).toBe(false);
    expect(permissionsForRole("analyst").has("orgs.read")).toBe(true);
    expect(permissionsForRole("analyst").has("orgs.write")).toBe(false);
    expect(platformAdminHasPermission({ role: "support", status: "active" }, "billing.write")).toBe(
      false,
    );
    expect(platformAdminHasPermission({ role: "owner", status: "disabled" }, "orgs.write")).toBe(
      false,
    );
  });

  it("filters platform nav by permissions", () => {
    const analystNav = platformNavGroupsForPermissions([...permissionsForRole("analyst")]);
    const hrefs = analystNav.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("/platform");
    expect(hrefs).toContain("/platform/organizations");
    expect(hrefs).not.toContain("/platform/staff");
    expect(hrefs).toContain("/platform/costs");
  });
});
