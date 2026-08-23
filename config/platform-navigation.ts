import {
  Activity,
  Building2,
  CreditCard,
  LayoutDashboard,
  Package,
  Receipt,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type PlatformNavGroupId =
  | "overview"
  | "analytics"
  | "tenants"
  | "product"
  | "system";

/** Collapsible Super Admin sidebar sections (Overview stays fixed). */
export const PLATFORM_NAV_ACCORDION_GROUP_IDS = [
  "analytics",
  "tenants",
  "product",
  "system",
] as const;

export type PlatformNavAccordionGroupId = (typeof PLATFORM_NAV_ACCORDION_GROUP_IDS)[number];

export const DEFAULT_PLATFORM_NAV_ACCORDION_GROUP: PlatformNavAccordionGroupId = "tenants";

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
        title: "Dashboard",
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
        title: "Revenue",
        href: "/platform/revenue",
        icon: TrendingUp,
      },
      {
        title: "Operating costs",
        href: "/platform/costs",
        icon: Receipt,
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
        title: "Subscriptions",
        href: "/platform/subscriptions",
        icon: CreditCard,
      },
    ],
  },
  {
    id: "product",
    label: "Product",
    items: [
      {
        title: "Downloads",
        href: "/platform/releases",
        icon: Package,
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      {
        title: "Health",
        href: "/platform/health",
        icon: Activity,
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

  const reserved = new Set([
    "organizations",
    "releases",
    "revenue",
    "costs",
    "subscriptions",
    "health",
    "payments",
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
