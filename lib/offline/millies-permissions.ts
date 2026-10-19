/**
 * Millie's staff permissions — role defaults plus optional per-user overrides.
 * UI and local auth share this module so create/edit cannot invent capabilities.
 */

import type { MilliesLocalRole } from "@/lib/offline/millies-auth-db";

export const APP_PERMISSIONS = [
  "sales.access",
  "returns.process",
  "products.manage",
  "cost.view",
  "stock.transfer",
  "users.manage",
  "users.deactivate",
  "staff.performance",
  "payroll.manage",
  "branches.manage",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

export const APP_PERMISSION_LABELS: Record<AppPermission, string> = {
  "sales.access": "Sales (POS)",
  "returns.process": "Process returns",
  "products.manage": "Manage products & inventory",
  "cost.view": "View cost prices",
  "stock.transfer": "Transfer stock",
  "users.manage": "Manage staff",
  "users.deactivate": "Activate / deactivate staff",
  "staff.performance": "View staff performance",
  "payroll.manage": "Manage payroll",
  "branches.manage": "Manage branches",
};

const ROLE_DEFAULTS: Record<MilliesLocalRole, readonly AppPermission[]> = {
  cashier: ["sales.access", "returns.process"],
  manager: [
    "sales.access",
    "returns.process",
    "products.manage",
    "cost.view",
    "stock.transfer",
    "users.manage",
    "users.deactivate",
    "staff.performance",
  ],
  administrator: [...APP_PERMISSIONS],
};

export function isAppPermission(value: string): value is AppPermission {
  return (APP_PERMISSIONS as readonly string[]).includes(value);
}

export function permissionsForRole(role: MilliesLocalRole): AppPermission[] {
  return [...ROLE_DEFAULTS[role]];
}

/** Prefer stored overrides when present; otherwise role defaults. */
export function resolveStaffPermissions(
  role: MilliesLocalRole,
  stored?: readonly string[] | null,
): AppPermission[] {
  if (!stored || stored.length === 0) return permissionsForRole(role);
  const next = stored.filter(isAppPermission);
  return next.length > 0 ? next : permissionsForRole(role);
}

export function hasStaffPermission(
  permissions: readonly AppPermission[],
  permission: AppPermission,
): boolean {
  return permissions.includes(permission);
}

export function assertCanManageStaff(actorRole: MilliesLocalRole): void {
  if (actorRole !== "administrator" && actorRole !== "manager") {
    throw new Error("Only administrators or managers can manage staff");
  }
}

export function assertCanAssignStaffRole(
  actorRole: MilliesLocalRole,
  targetRole: MilliesLocalRole,
): void {
  assertCanManageStaff(actorRole);
  if (actorRole === "manager" && targetRole !== "cashier") {
    throw new Error("Managers can only create or edit cashiers");
  }
}

/**
 * Managers may only grant cashier-default permissions (or a subset).
 * Administrators may only grant permissions they themselves hold.
 */
export function assertCanGrantStaffPermissions(
  actorRole: MilliesLocalRole,
  actorPermissions: readonly AppPermission[],
  targetRole: MilliesLocalRole,
  targetPermissions: readonly AppPermission[],
): void {
  assertCanAssignStaffRole(actorRole, targetRole);
  if (actorRole === "manager") {
    const allowed = new Set(permissionsForRole("cashier"));
    for (const permission of targetPermissions) {
      if (!allowed.has(permission)) {
        throw new Error("Managers cannot grant that permission");
      }
    }
    return;
  }
  const held = new Set(actorPermissions);
  for (const permission of targetPermissions) {
    if (!held.has(permission)) {
      throw new Error("You cannot grant a permission you do not have");
    }
  }
}

export function normalizePermissionList(
  values: readonly string[] | null | undefined,
): AppPermission[] | undefined {
  if (!values) return undefined;
  const next = values.filter(isAppPermission);
  return next.length > 0 ? next : undefined;
}
