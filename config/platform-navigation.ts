import {
  Activity,
  BarChart3,
  Building2,
  FileDown,
  LayoutDashboard,
  Bell,
  MessageSquare,
  Package,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { PlatformPermission } from "@/convex/shared/platformRoles";
import { permissionForPlatformPath } from "@/convex/shared/platformRoles";

export type PlatformNavGroupId = "overview" | "analytics" | "tenants";

/** Collapsible Super Admin sidebar sections (Overview stays fixed). */
export const PLATFORM_NAV_ACCORDION_GROUP_IDS = ["analytics", "tenants"] as const;

export type PlatformNavAccordionGroupId = (typeof PLATFORM_NAV_ACCORDION_GROUP_IDS)[number];

export const DEFAULT_PLATFORM_NAV_ACCORDION_GROUP: PlatformNavAccordionGroupId = "analytics";

export function isPlatformNavAccordionGroup(
  id: PlatformNavGroupId,
): id is PlatformNavAccordionGroupId {
  return (PLATFORM_NAV_ACCORDION_GROUP_IDS as readonly PlatformNavGroupId[]).includes(id);
}

export type PlatformNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Match pathname exactly (used for `/platform` overview). */
  exact?: boolean;
  /** Minimum permission to show this item. */
  permission: PlatformPermission;
};

export type PlatformNavGroup = {
  id: PlatformNavGroupId;
  label: string;
  items: PlatformNavItem[];
};

export const PLATFORM_NAV_GROUPS: PlatformNavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      {
        title: "Executive dashboard",
        href: "/platform",
        icon: LayoutDashboard,
        exact: true,
        permission: "overview.read",
      },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    items: [
      {
        title: "Monitoring",
        href: "/platform/analytics",
        icon: BarChart3,
        permission: "analytics.read",
      },
      {
        title: "Activity",
        href: "/platform/activity",
        icon: Activity,
        permission: "analytics.read",
      },
      {
        title: "Exports",
        href: "/platform/exports",
        icon: FileDown,
        permission: "analytics.read",
      },
    ],
  },
  {
    id: "tenants",
    label: "Tenants",
    items: [
      {
        title: "Organizations",
        href: "/platform/organizations",
        icon: Building2,
        permission: "orgs.read",
      },
      {
        title: "Releases",
        href: "/platform/releases",
        icon: Package,
        permission: "releases.read",
      },
      {
        title: "Operating costs",
        href: "/platform/costs",
        icon: Receipt,
        permission: "costs.read",
      },
      {
        title: "Platform staff",
        href: "/platform/staff",
        icon: Users,
        permission: "staff.manage",
      },
      {
        title: "SMS",
        href: "/platform/sms",
        icon: MessageSquare,
        permission: "sms.broadcast",
      },
      {
        title: "Notifications",
        href: "/platform/notifications",
        icon: Bell,
        permission: "sms.broadcast",
      },
    ],
  },
];

export function platformNavGroupsForPermissions(
  permissions: readonly string[] | null | undefined,
): PlatformNavGroup[] {
  const allowed = new Set(permissions ?? []);
  return PLATFORM_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => allowed.has(item.permission)),
  })).filter((group) => group.items.length > 0);
}

export function platformNavItemActive(pathname: string, item: PlatformNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function findPlatformNavGroupForPath(path: string): PlatformNavGroupId | null {
  if (path.startsWith("/platform/payments/")) return "analytics";
  if (path.startsWith("/platform/staff")) return "tenants";
  if (path.startsWith("/platform/sms") || path.startsWith("/platform/notifications")) {
    return "tenants";
  }
  if (path.startsWith("/platform/releases") || path.startsWith("/platform/costs")) {
    return "tenants";
  }
  if (
    path.startsWith("/platform/insights/") ||
    path.startsWith("/platform/revenue") ||
    path.startsWith("/platform/subscriptions") ||
    path.startsWith("/platform/health") ||
    path.startsWith("/platform/help")
  ) {
    return "analytics";
  }

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
  ]);
  const orgMatch = path.match(/^\/platform\/([^/]+)\/?$/);
  if (orgMatch && !reserved.has(orgMatch[1])) {
    return "tenants";
  }

  let best: { id: PlatformNavGroupId; hrefLength: number } | null = null;

  for (const group of PLATFORM_NAV_GROUPS) {
    for (const item of group.items) {
      if (!platformNavItemActive(path, item)) continue;
      const hrefLength = item.href.length;
      if (!best || hrefLength > best.hrefLength) {
        best = { id: group.id, hrefLength };
      }
    }
  }

  return best?.id ?? null;
}

export { permissionForPlatformPath };
