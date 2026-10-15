import type { AppRole } from "@/config/navigation";

export type TourId =
  "shell" | "sales" | "products" | "inventory" | "reports" | "users" | "settings" | "platform";

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
          '[data-tour="mobile-bottom-navigation"]',
          '[data-tour="mobile-navigation-trigger"]',
          '[data-tour="desktop-navigation"]',
        ],
        title: "Your workspace",
        description: "Use the navigation to move between the tools available to your role.",
        side: "right",
      },
      {
        id: "primary-content",
        anchors: ['[data-tour="page-content"]', "[data-novend-scroll-root]"],
        title: "Focused work area",
        description: "Each page keeps its primary actions and business information in this area.",
        side: "top",
      },
      {
        id: "sync",
        anchors: [
          '[data-tour="sync-status"]',
          '[data-tour="desktop-navigation"]',
          '[data-tour="account-menu"]',
        ],
        title: "Workspace status",
        description:
          "Your till keeps selling locally. Open Settings → Help & product tours anytime to replay walkthroughs.",
        side: "bottom",
      },
      {
        id: "account",
        anchors: [
          '[data-tour="account-menu"]',
          '[data-tour="mobile-more"]',
          '[data-tour="mobile-navigation-trigger"]',
          '[data-tour="desktop-navigation"]',
        ],
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

export const ONBOARDING_TOUR_ORDER: TourId[] = [
  "shell",
  "sales",
  "products",
  "inventory",
  "reports",
  "users",
  "settings",
  "platform",
];

/** First-run walkthrough order, filtered to the caller's role. */
export function onboardingQueue(role: AppRole | null, isPlatformAdmin: boolean): TourId[] {
  // Platform-only Super Admins must never enter the tenant POS tour chain
  // (shell → sales → …), which would router.push them off /platform into
  // tenant queries that throw Forbidden without an org profile.
  if (isPlatformAdmin && !role) return ["platform"];
  const allowed = new Set(toursForAccess(role, isPlatformAdmin).map((tour) => tour.id));
  return ONBOARDING_TOUR_ORDER.filter((id) => allowed.has(id));
}

export function hasTourProgress(
  progress: ReadonlyArray<{ tourId: string }>,
  available: ReadonlyArray<{ id: TourId }>,
) {
  const ids = new Set(available.map((tour) => tour.id));
  return progress.some((row) => ids.has(row.tourId as TourId));
}

type TourQueryRoot = {
  querySelector(selector: string): unknown;
  querySelectorAll?(selector: string): ArrayLike<unknown>;
};

/** True when the node is painted and large enough to highlight. Test doubles count as visible. */
export function isElementTourable(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  if (typeof Element === "undefined" || !(node instanceof Element)) return true;
  const style = window.getComputedStyle(node);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return false;
  }
  const rect = node.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  return true;
}

export function queryTourable(
  selector: string,
  root: TourQueryRoot = document,
  isTourable: (node: unknown) => boolean = isElementTourable,
): unknown {
  if (typeof root.querySelectorAll === "function") {
    const matches = root.querySelectorAll(selector);
    for (let index = 0; index < matches.length; index += 1) {
      const node = matches[index];
      if (isTourable(node)) return node;
    }
    return null;
  }
  const node = root.querySelector(selector);
  return node && isTourable(node) ? node : null;
}

export function resolveStepAnchor(
  step: TourStepDefinition,
  root: TourQueryRoot = document,
  isTourable: (node: unknown) => boolean = isElementTourable,
) {
  return (
    step.anchors.find((selector) => queryTourable(selector, root, isTourable)) ?? step.anchors[0]
  );
}

export function popoverSideForStep(
  step: TourStepDefinition,
  element: Element | null,
): NonNullable<TourStepDefinition["side"]> {
  if (element) {
    const tourId = element.getAttribute("data-tour");
    if (
      tourId === "mobile-bottom-navigation" ||
      (typeof element.closest === "function" &&
        element.closest('[data-tour="mobile-bottom-navigation"]'))
    ) {
      return "top";
    }
    if (tourId === "mobile-more") return "top";
    if (tourId === "mobile-navigation-trigger") return "bottom";
  }
  return step.side ?? "bottom";
}
