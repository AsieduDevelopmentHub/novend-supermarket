/**
 * Platform (Novend Super Admin console) RBAC — distinct from tenant AppRole.
 *
 * Membership lives in `platformAdmins`. Missing `role` on legacy rows = owner.
 */

export const PLATFORM_ROLES = ["owner", "operator", "support", "analyst"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PLATFORM_PERMISSIONS = [
  "overview.read",
  "analytics.read",
  "orgs.read",
  "orgs.write",
  "billing.write",
  "entitlements.write",
  "releases.read",
  "releases.write",
  "costs.read",
  "costs.write",
  "staff.manage",
  "sms.broadcast",
] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export type PlatformAdminFields = {
  role?: PlatformRole | string | null;
  status?: "active" | "disabled" | string | null;
};

const ALL_PERMISSIONS: readonly PlatformPermission[] = PLATFORM_PERMISSIONS;

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, readonly PlatformPermission[]> = {
  owner: ALL_PERMISSIONS,
  operator: ALL_PERMISSIONS.filter((p) => p !== "staff.manage"),
  support: ["overview.read", "analytics.read", "orgs.read", "orgs.write", "releases.read"],
  analyst: ["overview.read", "analytics.read", "orgs.read", "releases.read", "costs.read"],
};

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  owner: "Owner",
  operator: "Operator",
  support: "Support",
  analyst: "Analyst",
};

export const PLATFORM_ROLE_DESCRIPTIONS: Record<PlatformRole, string> = {
  owner: "Full platform access, including staff management.",
  operator: "Day-to-day tenant, billing, entitlements, and releases — cannot manage staff.",
  support: "Help tenants: view analytics and edit organizations — no billing or entitlements.",
  analyst: "Read-only dashboards, organizations, releases, and costs.",
};

export function isPlatformRole(value: unknown): value is PlatformRole {
  return typeof value === "string" && (PLATFORM_ROLES as readonly string[]).includes(value);
}

export function isPlatformPermission(value: unknown): value is PlatformPermission {
  return typeof value === "string" && (PLATFORM_PERMISSIONS as readonly string[]).includes(value);
}

/** Legacy rows without role are treated as owner. */
export function resolvePlatformRole(admin: PlatformAdminFields | null | undefined): PlatformRole {
  if (admin && isPlatformRole(admin.role)) return admin.role;
  return "owner";
}

export function isPlatformAdminActive(admin: PlatformAdminFields | null | undefined): boolean {
  if (!admin) return false;
  return admin.status !== "disabled";
}

export function permissionsForRole(role: PlatformRole): ReadonlySet<PlatformPermission> {
  return new Set(PLATFORM_ROLE_PERMISSIONS[role]);
}

export function platformAdminHasPermission(
  admin: PlatformAdminFields | null | undefined,
  permission: PlatformPermission,
): boolean {
  if (!isPlatformAdminActive(admin)) return false;
  return permissionsForRole(resolvePlatformRole(admin)).has(permission);
}

/** Nav / route → minimum permission to show or enter. */
export const PLATFORM_ROUTE_PERMISSION: Record<string, PlatformPermission> = {
  "/platform": "overview.read",
  "/platform/analytics": "analytics.read",
  "/platform/activity": "analytics.read",
  "/platform/exports": "analytics.read",
  "/platform/revenue": "analytics.read",
  "/platform/subscriptions": "analytics.read",
  "/platform/health": "analytics.read",
  "/platform/help": "overview.read",
  "/platform/organizations": "orgs.read",
  "/platform/releases": "releases.read",
  "/platform/costs": "costs.read",
  "/platform/staff": "staff.manage",
  "/platform/sms": "sms.broadcast",
  "/platform/notifications": "sms.broadcast",
};

export function permissionForPlatformPath(pathname: string): PlatformPermission | null {
  if (pathname.startsWith("/platform/payments/")) return "analytics.read";
  if (pathname.startsWith("/platform/insights/")) return "analytics.read";
  if (pathname.startsWith("/platform/releases")) return "releases.read";
  if (pathname.startsWith("/platform/costs")) return "costs.read";
  if (pathname.startsWith("/platform/staff")) return "staff.manage";
  if (pathname.startsWith("/platform/sms")) return "sms.broadcast";
  if (pathname.startsWith("/platform/notifications")) return "sms.broadcast";
  if (pathname.startsWith("/platform/organizations")) return "orgs.read";
  if (pathname === "/platform" || pathname === "/platform/") return "overview.read";

  const reserved = new Set([
    "organizations",
    "releases",
    "revenue",
    "costs",
    "subscriptions",
    "health",
    "payments",
    "analytics",
    "activity",
    "exports",
    "help",
    "staff",
    "sms",
    "notifications",
  ]);
  const orgMatch = pathname.match(/^\/platform\/([^/]+)/);
  if (orgMatch && !reserved.has(orgMatch[1])) return "orgs.read";

  const exact = PLATFORM_ROUTE_PERMISSION[pathname];
  if (exact) return exact;
  for (const [prefix, permission] of Object.entries(PLATFORM_ROUTE_PERMISSION)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return permission;
  }
  return "overview.read";
}
