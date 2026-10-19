import { describe, expect, it } from "vitest";
import {
  assertCanGrantStaffPermissions,
  assertCanAssignStaffRole,
  hasStaffPermission,
  permissionsForRole,
  resolveStaffPermissions,
} from "@/lib/offline/millies-permissions";

describe("millies staff permissions", () => {
  it("gives cashiers sales and returns only by default", () => {
    expect(permissionsForRole("cashier")).toEqual(["sales.access", "returns.process"]);
    expect(hasStaffPermission(permissionsForRole("cashier"), "cost.view")).toBe(false);
  });

  it("gives administrators every permission", () => {
    expect(permissionsForRole("administrator")).toContain("payroll.manage");
    expect(permissionsForRole("administrator")).toContain("branches.manage");
  });

  it("uses stored overrides when present", () => {
    expect(
      resolveStaffPermissions("cashier", ["sales.access", "products.manage", "nope"]),
    ).toEqual(["sales.access", "products.manage"]);
  });

  it("blocks managers from assigning admin roles", () => {
    expect(() => assertCanAssignStaffRole("manager", "administrator")).toThrow(/cashiers/i);
  });

  it("blocks managers from granting elevated permissions", () => {
    expect(() =>
      assertCanGrantStaffPermissions(
        "manager",
        permissionsForRole("manager"),
        "cashier",
        ["sales.access", "products.manage"],
      ),
    ).toThrow(/cannot grant/i);
  });

  it("allows admins to grant permissions they hold", () => {
    expect(() =>
      assertCanGrantStaffPermissions(
        "administrator",
        permissionsForRole("administrator"),
        "cashier",
        ["sales.access", "returns.process", "cost.view"],
      ),
    ).not.toThrow();
  });
});
