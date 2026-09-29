import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Package,
  Boxes,
  Users,
  BarChart3,
  LineChart,
  Settings,
  UserCog,
  Building2,
  Undo2,
  Warehouse,
  Truck,
  UtensilsCrossed,
  ChefHat,
  BedDouble,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import {
  isStockOpsNavHref,
  stockOpsVisibleForIndustry,
  type BusinessCapabilityKey,
  type IndustryProfile,
} from "@/convex/shared/businessCapabilities";
import {
  resolveNavTitleFromTerms,
  type BusinessTermsMap,
} from "@/convex/shared/businessTerms";
import type { FeatureKey } from "@/convex/shared/features";
import type { BillingVisibility } from "@/convex/shared/organizationConfig";

export type AppRole = "administrator" | "manager" | "cashier";

export type NavGroupId = "overview" | "sales" | "inventory" | "business" | "administration";

/** Collapsible sidebar sections (Overview is always visible as a fixed link). */
export const NAV_ACCORDION_GROUP_IDS = [
  "sales",
  "inventory",
  "business",
  "administration",
] as const;

export type NavAccordionGroupId = (typeof NAV_ACCORDION_GROUP_IDS)[number];

export const DEFAULT_NAV_ACCORDION_GROUP: NavAccordionGroupId = "sales";

export function isNavAccordionGroup(id: NavGroupId): id is NavAccordionGroupId {
  return (NAV_ACCORDION_GROUP_IDS as readonly NavGroupId[]).includes(id);
}

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: AppRole[];
  stub?: boolean;
  /**
   * When set, every listed org capability must be enabled (and plan-allowed).
   * Omit for routes that exist for all orgs (default Novend).
   */
  capabilities?: BusinessCapabilityKey[];
  /** When set, every listed feature entitlement must be enabled. */
  features?: FeatureKey[];
};

export type NavGroup = {
  id: NavGroupId;
  label: string;
  defaultExpanded: boolean;
  items: NavItem[];
};

export const SETTINGS_ITEM: NavItem = {
  title: "Settings",
  href: "/settings",
  icon: Settings,
  roles: ["administrator", "manager", "cashier"],
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    defaultExpanded: false,
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["administrator", "manager", "cashier"],
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    defaultExpanded: true,
    items: [
      {
        title: "Sales (POS)",
        href: "/sales",
        icon: ShoppingCart,
        roles: ["administrator", "manager", "cashier"],
      },
      {
        title: "Orders",
        href: "/orders",
        icon: ClipboardList,
        roles: ["administrator", "manager", "cashier"],
      },
      {
        title: "Returns",
        href: "/returns",
        icon: Undo2,
        roles: ["administrator", "manager", "cashier"],
      },
      {
        title: "Customers",
        href: "/customers",
        icon: Users,
        roles: ["administrator", "manager", "cashier"],
      },
      {
        title: "Floor",
        href: "/floor",
        icon: UtensilsCrossed,
        roles: ["administrator", "manager", "cashier"],
        capabilities: ["tables_orders"],
      },
      {
        title: "Kitchen",
        href: "/kitchen",
        icon: ChefHat,
        roles: ["administrator", "manager", "cashier"],
        capabilities: ["kitchen_tickets"],
      },
      {
        title: "Rooms",
        href: "/rooms",
        icon: BedDouble,
        roles: ["administrator", "manager", "cashier"],
        capabilities: ["rooms_folio"],
      },
      {
        title: "Reservations",
        href: "/reservations",
        icon: CalendarDays,
        roles: ["administrator", "manager", "cashier"],
        capabilities: ["reservations"],
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    defaultExpanded: false,
    items: [
      {
        title: "Products",
        href: "/products",
        icon: Package,
        roles: ["administrator", "manager", "cashier"],
      },
      {
        title: "Inventory",
        href: "/inventory",
        icon: Boxes,
        roles: ["administrator", "manager", "cashier"],
      },
      {
        title: "Wholesale",
        href: "/wholesale",
        icon: Warehouse,
        roles: ["administrator", "manager"],
        features: ["inventory.wholesale"],
      },
      {
        title: "Suppliers",
        href: "/suppliers",
        icon: Truck,
        roles: ["administrator", "manager"],
      },
    ],
  },
  {
    id: "business",
    label: "Business",
    defaultExpanded: false,
    items: [
      {
        title: "Analytics",
        href: "/analytics",
        icon: LineChart,
        roles: ["administrator", "manager"],
        features: ["reports.advanced"],
      },
      {
        title: "Reports",
        href: "/reports",
        icon: BarChart3,
        roles: ["administrator", "manager", "cashier"],
      },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    defaultExpanded: false,
    items: [
      {
        title: "Branches",
        href: "/branches",
        icon: Building2,
        roles: ["administrator"],
        features: ["branches.multiBranch"],
      },
      {
        title: "Users",
        href: "/users",
        icon: UserCog,
        roles: ["administrator", "manager"],
      },
    ],
  },
];

/** Flat list of all routable items (groups + settings). */
export const NAV_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((group) => group.items), SETTINGS_ITEM];

export type NavFeatureGate = {
  features?: Partial<Record<FeatureKey, boolean>> | null;
  billingVisibility?: BillingVisibility | null;
  /** When restaurant/hotel, stock-ops nav routes are hidden (presentation). */
  industryProfile?: IndustryProfile | string | null;
};

export function defaultNavGroupExpanded(): Record<NavGroupId, boolean> {
  return NAV_GROUPS.reduce(
    (acc, group) => {
      acc[group.id] = group.id === DEFAULT_NAV_ACCORDION_GROUP;
      return acc;
    },
    {} as Record<NavGroupId, boolean>,
  );
}

export function defaultActiveAccordionGroup(): NavAccordionGroupId {
  return DEFAULT_NAV_ACCORDION_GROUP;
}

function itemAllowedByFeatures(item: NavItem, gate: NavFeatureGate): boolean {
  if (!item.features?.length) return true;
  const features = gate.features;
  if (!features) return true;
  return item.features.every((key) => features[key] === true);
}

export function navGroupsForRole(
  role: AppRole,
  enabledCapabilities: readonly BusinessCapabilityKey[] = [],
  gate: NavFeatureGate = {},
  terms?: BusinessTermsMap | null,
): NavGroup[] {
  const enabled = new Set(enabledCapabilities);
  const stockOps = stockOpsVisibleForIndustry(gate.industryProfile);
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => {
        if (!item.roles.includes(role)) return false;
        if (!stockOps && isStockOpsNavHref(item.href)) return false;
        if (item.capabilities?.length && !item.capabilities.every((key) => enabled.has(key))) {
          return false;
        }
        return itemAllowedByFeatures(item, gate);
      })
      .map((item) =>
        terms
          ? { ...item, title: resolveNavTitleFromTerms(item.href, terms, item.title) }
          : item,
      ),
  })).filter((group) => group.items.length > 0);
}

export function flatNavForRole(
  role: AppRole,
  enabledCapabilities: readonly BusinessCapabilityKey[] = [],
  gate: NavFeatureGate = {},
  terms?: BusinessTermsMap | null,
): NavItem[] {
  const items = navGroupsForRole(role, enabledCapabilities, gate, terms).flatMap(
    (group) => group.items,
  );
  if (SETTINGS_ITEM.roles.includes(role)) {
    items.push(SETTINGS_ITEM);
  }
  return items;
}

/** Super Admin console paths. Tenant role ACL does not cover these. */
export function isPlatformAppPath(path: string): boolean {
  const pathname = path.split("?")[0] || path;
  return pathname === "/platform" || pathname.startsWith("/platform/");
}

/** True when Billing UI should be hidden for this organization. */
export function isBillingHidden(gate: NavFeatureGate): boolean {
  if (gate.billingVisibility === "hidden") return true;
  if (gate.features && gate.features["billing.view"] === false) return true;
  return false;
}

/** True when `path` is allowed for this role (nav + settings). Platform is separate. */
export function pathAllowedForRole(
  path: string,
  role: AppRole,
  enabledCapabilities: readonly BusinessCapabilityKey[] = [],
  gate: NavFeatureGate = {},
): boolean {
  const pathname = path.split("?")[0] || path;
  const search = path.includes("?") ? path.slice(path.indexOf("?")) : "";
  if (pathname === "/more" || pathname.startsWith("/more/")) return true;
  if (pathname === "/about" || pathname.startsWith("/about/")) return true;
  if (pathname === "/unauthorized") return true;
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return true;

  // Direct deep-link to Billing when platform hid it.
  if (
    pathname === "/settings" &&
    (search.includes("section=billing") || search.includes("section%3Dbilling")) &&
    isBillingHidden(gate)
  ) {
    return false;
  }

  return flatNavForRole(role, enabledCapabilities, gate).some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

/** @deprecated Prefer navGroupsForRole or flatNavForRole. */
export function navForRole(
  role: AppRole,
  enabledCapabilities: readonly BusinessCapabilityKey[] = [],
  gate: NavFeatureGate = {},
  terms?: BusinessTermsMap | null,
) {
  return flatNavForRole(role, enabledCapabilities, gate, terms);
}

export function findNavGroupForPath(path: string): NavGroupId | null {
  for (const group of NAV_GROUPS) {
    if (group.items.some((item) => path === item.href || path.startsWith(`${item.href}/`))) {
      return group.id;
    }
  }
  return null;
}

export const ROUTES = {
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  platform: "/platform",
  download: "/download",
  privacy: "/privacy",
  terms: "/terms",
  refund: "/refund",
  cookies: "/cookies",
  aup: "/aup",
  dpa: "/dpa",
} as const;
