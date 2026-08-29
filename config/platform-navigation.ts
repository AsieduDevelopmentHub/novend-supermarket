import {
  Activity,
  BarChart3,
  Building2,
  FileDown,
  LayoutDashboard,
  Package,
  Receipt,
  type LucideIcon,
} from "lucide-react";

export type PlatformNavGroupId = "overview" | "analytics" | "tenants";

/** Collapsible Super Admin sidebar sections (Overview stays fixed). */
export const PLATFORM_NAV_ACCORDION_GROUP_IDS = [
  "analytics",
  "tenants",
] as const;

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
      },
      {
        title: "Activity",
        href: "/platform/activity",
        icon: Activity,
      },
      {
        title: "Exports",
        href: "/platform/exports",
        icon: FileDown,
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
      },
      {
        title: "Releases",
        href: "/platform/releases",
        icon: Package,
      },
      {
        title: "Operating costs",
        href: "/platform/costs",
        icon: Receipt,
      },
    ],
  },
];

export function platformNavItemActive(pathname: string, item: PlatformNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function findPlatformNavGroupForPath(path: string): PlatformNavGroupId | null {
  if (path.startsWith("/platform/payments/")) return "analytics";
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
