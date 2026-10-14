import type { AppRole, NavFeatureGate, NavItem } from "@/config/navigation";
import { flatNavForRole } from "@/config/navigation";
import {
  stockOpsVisibleForIndustry,
  type BusinessCapabilityKey,
} from "@/convex/shared/businessCapabilities";
import type { BusinessTermsMap } from "@/convex/shared/businessTerms";
import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  MoreHorizontal,
  Package,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

export type MobileTabId = "dashboard" | "sales" | "inventory" | "orders" | "more";

export type MobileTab = {
  id: MobileTabId;
  title: string;
  href: string;
  icon: LucideIcon;
};

/** Primary Capacitor bottom tabs — desktop sidebar is unchanged. */
export const MOBILE_BOTTOM_TABS: MobileTab[] = [
  { id: "dashboard", title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "sales", title: "Sales", href: "/sales", icon: ShoppingCart },
  { id: "inventory", title: "Inventory", href: "/inventory", icon: Boxes },
  { id: "orders", title: "Orders", href: "/orders", icon: ClipboardList },
  { id: "more", title: "More", href: "/more", icon: MoreHorizontal },
];

/** Restaurant/hotel: catalogue tab instead of inventory stock. */
const MOBILE_CATALOGUE_TAB: MobileTab = {
  id: "inventory",
  title: "Products",
  href: "/products",
  icon: Package,
};

const TAB_HREFS = new Set(MOBILE_BOTTOM_TABS.map((t) => t.href));

export function mobileBottomTabsForIndustry(
  industryProfile?: string | null,
  terms?: BusinessTermsMap | null,
): MobileTab[] {
  if (stockOpsVisibleForIndustry(industryProfile)) return MOBILE_BOTTOM_TABS;
  const catalogueTitle = terms?.product_plural ?? MOBILE_CATALOGUE_TAB.title;
  return MOBILE_BOTTOM_TABS.map((tab) =>
    tab.id === "inventory" ? { ...MOBILE_CATALOGUE_TAB, title: catalogueTitle } : tab,
  );
}

export type MoreSection = {
  id: string;
  label: string;
  items: NavItem[];
};

const MORE_SECTIONS: Array<{ id: string; label: string; hrefs: string[] }> = [
  {
    id: "operations",
    label: "Operations",
    hrefs: ["/floor", "/kitchen", "/rooms", "/reservations"],
  },
  {
    id: "business",
    label: "Business",
    hrefs: ["/returns", "/customers", "/suppliers", "/products"],
  },
  {
    id: "insights",
    label: "Insights",
    hrefs: ["/analytics", "/reports"],
  },
  {
    id: "administration",
    label: "Administration",
    hrefs: ["/users"],
  },
  {
    id: "system",
    label: "System",
    hrefs: ["/settings"],
  },
];

/** Routes that live only under More (not duplicated in bottom tabs). */
export function moreSectionsForRole(
  role: AppRole,
  enabledCapabilities: readonly BusinessCapabilityKey[] = [],
  gate: NavFeatureGate = {},
  terms?: BusinessTermsMap | null,
): MoreSection[] {
  const allowed = new Map(
    flatNavForRole(role, enabledCapabilities, gate, terms).map((item) => [item.href, item]),
  );
  return MORE_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    items: section.hrefs
      .map((href) => allowed.get(href))
      .filter((item): item is NavItem => Boolean(item) && !TAB_HREFS.has(item!.href)),
  })).filter((section) => section.items.length > 0);
}

export function resolveMobileTab(pathname: string): MobileTabId {
  if (pathname === "/more" || pathname.startsWith("/more/")) return "more";
  // Restaurant/hotel catalogue tab uses /products under the inventory slot.
  if (pathname === "/products" || pathname.startsWith("/products/")) return "inventory";
  for (const tab of MOBILE_BOTTOM_TABS) {
    if (tab.id === "more") continue;
    if (pathname === tab.href || pathname.startsWith(`${tab.href}/`)) return tab.id;
  }
  // Nested destinations that belong under More keep More highlighted.
  return "more";
}

/** Bottom inset for content above the curved Cap tab bar + system nav. */
export const MOBILE_TAB_BAR_OFFSET = "var(--novend-tabbar-offset)";
