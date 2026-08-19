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

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: AppRole[];
  stub?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["administrator", "manager", "cashier"],
  },
  {
    title: "Sales",
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
  {
    title: "Products",
    href: "/products",
    icon: Package,
    roles: ["administrator", "manager", "cashier"],
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
    roles: ["administrator", "manager", "cashier"],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["administrator", "manager", "cashier"],
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: LineChart,
    roles: ["administrator", "manager"],
  },
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
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["administrator", "manager", "cashier"],
  },
];

export function navForRole(role: AppRole) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export const ROUTES = {
  login: "/login",
  signup: "/signup",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  platform: "/platform",
} as const;
