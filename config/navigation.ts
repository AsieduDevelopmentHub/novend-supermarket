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
  type LucideIcon,
} from "lucide-react";

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

export function navGroupsForRole(role: AppRole): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

export function flatNavForRole(role: AppRole): NavItem[] {
  const items = navGroupsForRole(role).flatMap((group) => group.items);
  if (SETTINGS_ITEM.roles.includes(role)) {
    items.push(SETTINGS_ITEM);
  }
  return items;
}

/** @deprecated Prefer navGroupsForRole or flatNavForRole. */
export function navForRole(role: AppRole) {
  return flatNavForRole(role);
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
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  platform: "/platform",
} as const;
