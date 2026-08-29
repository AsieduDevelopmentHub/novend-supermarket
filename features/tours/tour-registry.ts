import type { AppRole } from "@/config/navigation";

export type TourId =
  | "shell"
  | "sales"
  | "products"
  | "inventory"
  | "reports"
  | "users"
  | "settings"
  | "platform";

export type TourStepDefinition = {
  id: string;
  anchors: string[];
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
};

export type TourDefinition = {
  id: TourId;
  version: number;
  title: string;
  description: string;
  path: string;
  roles?: AppRole[];
  platformOnly?: boolean;
  steps: TourStepDefinition[];
};

export const TOUR_REGISTRY: TourDefinition[] = [
  {
    id: "shell",
    version: 1,
    title: "Welcome to Novend",
    description: "Learn the core workspace controls before starting work.",
    path: "/dashboard",
    steps: [
      {
        id: "navigation",
        anchors: [
          '[data-tour="desktop-navigation"]',
          '[data-tour="mobile-bottom-navigation"]',
          '[data-tour="mobile-navigation-trigger"]',
        ],
        title: "Your workspace",
        description: "Use the navigation to move between the tools available to your role.",
        side: "right",
      },
      {
        id: "primary-content",
        anchors: ['[data-tour="page-content"]', '[data-novend-scroll-root]'],
        title: "Focused work area",
        description: "Each page keeps its primary actions and business information in this area.",
        side: "top",
      },
      {
        id: "sync",
        anchors: ['[data-tour="sync-status"]'],
        title: "Offline and sync status",
        description: "Novend keeps work available offline and shows when changes are safely synced.",
        side: "bottom",
      },
      {
        id: "account",
        anchors: ['[data-tour="account-menu"]'],
        title: "Account and help",
        description: "Open your account menu for settings, tours, and sign out.",
        side: "top",
      },
    ],
  },
  {
    id: "sales",
    version: 1,
    title: "Make a sale",
    description: "Find products, build the cart, take payment, and issue the receipt.",
    path: "/sales",
    steps: [
      {
        id: "catalog-search",
        anchors: ['[data-tour="sales-search"]'],
        title: "Find products quickly",
        description: "Search by name, SKU, or barcode to keep checkout moving.",
      },
      {
        id: "catalog",
        anchors: ['[data-tour="sales-catalog"]'],
        title: "Add items",
        description: "Select products and pack sizes to build the customer order.",
      },
      {
        id: "cart",
        anchors: ['[data-tour="sales-cart"]'],
        title: "Review the cart",
        description: "Confirm quantities, discounts, and totals before payment.",
        side: "left",
      },
      {
        id: "checkout",
        anchors: ['[data-tour="sales-checkout"]'],
        title: "Complete checkout",
        description: "Choose payment, complete the sale, and produce the immutable receipt.",
        side: "top",
      },
    ],
  },
  {
    id: "products",
    version: 1,
    title: "Manage products",
    description: "Create, find, and maintain the sellable catalog.",
    path: "/products",
    roles: ["administrator", "manager"],
    steps: [
      {
        id: "add",
        anchors: ['[data-tour="products-add"]'],
        title: "Add a product",
        description: "Create a product with its unique SKU, prices, category, and stock settings.",
      },
      {
        id: "search",
        anchors: ['[data-tour="products-search"]'],
        title: "Search and filter",
        description: "Narrow the catalog without losing your current workflow.",
      },
      {
        id: "list",
        anchors: ['[data-tour="products-list"]'],
        title: "Product catalog",
        description: "Open a product to review details, variants, and inventory history.",
      },
    ],
  },
  {
    id: "inventory",
    version: 1,
    title: "Control inventory",
    description: "Monitor stock and record every adjustment with a business reason.",
    path: "/inventory",
    roles: ["administrator", "manager"],
    steps: [
      {
        id: "summary",
        anchors: ['[data-tour="inventory-summary"]'],
        title: "Stock health",
        description: "Review available, low, and out-of-stock items at a glance.",
      },
      {
        id: "filters",
        anchors: ['[data-tour="inventory-filters"]'],
        title: "Find stock",
        description: "Filter by branch, status, category, or product.",
      },
      {
        id: "adjustment",
        anchors: ['[data-tour="inventory-adjustment"]'],
        title: "Record a stock change",
        description: "Every adjustment requires a reason and becomes part of inventory history.",
      },
    ],
  },
  {
    id: "reports",
    version: 1,
    title: "Understand performance",
    description: "Use trusted business reports and export presentation-ready results.",
    path: "/reports",
    roles: ["administrator", "manager"],
    steps: [
      {
        id: "range",
        anchors: ['[data-tour="reports-range"]'],
        title: "Choose a period",
        description: "Change the reporting range and branch scope for every metric.",
      },
      {
        id: "summary",
        anchors: ['[data-tour="reports-summary"]'],
        title: "Business overview",
        description: "Start with the headline numbers, then open details for an audit trail.",
      },
      {
        id: "export",
        anchors: ['[data-tour="reports-export"]'],
        title: "Export reports",
        description: "Download the current view in the format needed for review or submission.",
      },
    ],
  },
  {
    id: "users",
    version: 1,
    title: "Manage staff",
    description: "Invite staff and keep access aligned with each person's responsibilities.",
    path: "/users",
    roles: ["administrator", "manager"],
    steps: [
      {
        id: "add",
        anchors: ['[data-tour="users-add"]'],
        title: "Add a staff account",
        description: "Create an account with the least-privilege role and branch assignment.",
      },
      {
        id: "list",
        anchors: ['[data-tour="users-list"]'],
        title: "Review access",
        description: "Open a team member to review status, role, branch, and recent activity.",
      },
    ],
  },
  {
    id: "settings",
    version: 1,
    title: "Configure Novend",
    description: "Manage organization preferences, hardware, backups, and help.",
    path: "/settings",
    steps: [
      {
        id: "sections",
        anchors: ['[data-tour="settings-sections"]'],
        title: "Settings sections",
        description: "Only settings allowed by your role appear here.",
      },
      {
        id: "tours",
        anchors: ['[data-tour="settings-tours"]'],
        title: "Help and tours",
        description: "Replay any available walkthrough whenever your team needs a refresher.",
      },
    ],
  },
  {
    id: "platform",
    version: 1,
    title: "Platform monitoring",
    description: "Monitor the multi-tenant SaaS estate without exposing tenant business payloads.",
    path: "/platform",
    platformOnly: true,
    steps: [
      {
        id: "navigation",
        anchors: ['[data-tour="platform-navigation"]'],
        title: "Platform console",
        description: "Move between monitoring, organizations, activity, and exports.",
        side: "right",
      },
      {
        id: "overview",
        anchors: ['[data-tour="platform-overview"]'],
        title: "Executive monitoring",
        description: "Track adoption, revenue, runtimes, downloads, releases, and health.",
      },
      {
        id: "export",
        anchors: ['a[href="/platform/exports"]'],
        title: "Submission-ready exports",
        description: "Generate a branded PDF, detailed workbook, or portable CSV.",
      },
    ],
  },
];

export function getTourDefinition(id: TourId) {
  return TOUR_REGISTRY.find((tour) => tour.id === id);
}

export function toursForAccess(role: AppRole | null, isPlatformAdmin: boolean) {
  return TOUR_REGISTRY.filter((tour) => {
    if (tour.platformOnly) return isPlatformAdmin;
    if (!role) return false;
    return !tour.roles || tour.roles.includes(role);
  });
}

export function tourForPath(pathname: string, role: AppRole | null, isPlatformAdmin: boolean) {
  return toursForAccess(role, isPlatformAdmin)
    .filter((tour) => tour.id !== "shell")
    .find((tour) => pathname === tour.path || pathname.startsWith(`${tour.path}/`));
}

export function resolveStepAnchor(step: TourStepDefinition, root: ParentNode = document) {
  return step.anchors.find((selector) => root.querySelector(selector)) ?? step.anchors[0];
}
