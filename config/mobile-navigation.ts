import type { AppRole, NavItem } from "@/config/navigation";
import { flatNavForRole } from "@/config/navigation";
import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  MoreHorizontal,
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

const TAB_HREFS = new Set(MOBILE_BOTTOM_TABS.map((t) => t.href));

export type MoreSection = {
  id: string;
  label: string;
  items: NavItem[];
};

const MORE_SECTIONS: Array<{ id: string; label: string; hrefs: string[] }> = [
  {
    id: "business",
    label: "Business",
    hrefs: ["/returns", "/customers", "/wholesale", "/suppliers", "/products"],
  },
  {
    id: "insights",
    label: "Insights",
    hrefs: ["/analytics", "/reports"],
  },
  {
    id: "administration",
    label: "Administration",
    hrefs: ["/branches", "/users"],
  },
  {
    id: "system",
    label: "System",
    hrefs: ["/settings"],
  },
];

/** Routes that live only under More (not duplicated in bottom tabs). */
export function moreSectionsForRole(role: AppRole): MoreSection[] {
  const allowed = new Map(flatNavForRole(role).map((item) => [item.href, item]));
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
  for (const tab of MOBILE_BOTTOM_TABS) {
    if (tab.id === "more") continue;
    if (pathname === tab.href || pathname.startsWith(`${tab.href}/`)) return tab.id;
  }
  // Nested destinations that belong under More keep More highlighted.
  return "more";
}

/** Bottom inset for content above the curved Cap tab bar (+ safe area). */
export const MOBILE_TAB_BAR_OFFSET =
  "calc(5.25rem + env(safe-area-inset-bottom, 0px))";
