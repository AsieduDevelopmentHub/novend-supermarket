import { FEATURE_BLOCK_SCREENS, MARKETING_UI_SCREENS } from "@/constants/marketing-ui-screens";

export type ProductPageSlug = "pos" | "inventory" | "branches" | "reports" | "offline-sync";

export type ProductPageContent = {
  slug: ProductPageSlug;
  eyebrow: string;
  title: string;
  summary: string;
  problem: string;
  heroImage: string;
  heroAlt: string;
  outcome: string;
  workflow: ReadonlyArray<{ title: string; detail: string }>;
  capabilities: ReadonlyArray<string>;
  deepDives: ReadonlyArray<{
    title: string;
    detail: string;
    image: string;
    imageAlt: string;
  }>;
  offlineNote: string;
  hardwareNote: string;
  platforms: string;
  faq: ReadonlyArray<{ question: string; answer: string }>;
  related: ReadonlyArray<{ href: string; label: string }>;
};

export const PRODUCT_PAGES: Record<ProductPageSlug, ProductPageContent> = {
  pos: {
    slug: "pos",
    eyebrow: "Point of sale",
    title: "Sell without interruption",
    summary:
      "Barcode-ready checkout, hold and resume, receipts, and offline selling after setup—so an outage does not close the counter.",
    problem:
      "When the network drops mid-queue, staff should not lose the sale or rebuild the cart from memory. Novend keeps the counter moving on the device after setup.",
    heroImage: FEATURE_BLOCK_SCREENS.checkout,
    heroAlt: "Novend POS checkout with catalog and cart",
    outcome: "Keep the queue moving with a counter built for everyday retail speed.",
    workflow: [
      {
        title: "Scan or search",
        detail:
          "Add items by barcode scan or catalog search. Adjust quantities, packs, and discounts without leaving the sale.",
      },
      {
        title: "Hold when needed",
        detail:
          "Park a cart for a moment, resume later, and keep other cashiers selling from their own stations.",
      },
      {
        title: "Take payment",
        detail:
          "Complete with cash or other recorded methods, print or share the receipt, and lock the sale as immutable history.",
      },
      {
        title: "Keep selling offline",
        detail:
          "After setup, core selling continues on the device when connectivity fails. Pending work uploads when you reconnect.",
      },
    ],
    capabilities: [
      "Barcode-ready checkout with catalog search",
      "Hold and resume sales per cashier",
      "Receipt print and share options",
      "Offline selling after initial setup",
      "Immutable completed sales with return workflows for corrections",
      "Customer lookup at checkout when entitled",
    ],
    deepDives: [
      {
        title: "A counter built for speed",
        detail:
          "The sales screen keeps catalog, cart, and payment actions in one place. Cashiers stay in rhythm without hunting through menus.",
        image: MARKETING_UI_SCREENS.salesPos,
        imageAlt: "Novend POS sales screen",
      },
      {
        title: "Receipts that close the sale",
        detail:
          "Print or share a receipt after payment. Each completed sale produces one immutable record your reports can trust.",
        image: MARKETING_UI_SCREENS.salesPosReceiptModal,
        imageAlt: "Novend POS receipt modal",
      },
      {
        title: "Orders and history nearby",
        detail:
          "Find recent invoices, open order detail, and start a return without leaving the sales workflow.",
        image: MARKETING_UI_SCREENS.salesOrders,
        imageAlt: "Novend sales orders list",
      },
    ],
    offlineNote:
      "Core checkout continues offline after initial setup. Sign-in, billing, device activation, and some account actions still need connectivity.",
    hardwareNote:
      "Desktop is preferred for barcode scanners and receipt printers. Android and iPhone/iPad PWA cover floor sales and manager checks.",
    platforms: "Windows, macOS, Linux, Android, web, and iPhone/iPad PWA",
    faq: [
      {
        question: "Can cashiers sell without internet?",
        answer:
          "Yes—after the device has completed initial setup and sync. Core selling writes locally first, then uploads when you reconnect.",
      },
      {
        question: "Can I edit a completed sale?",
        answer:
          "No. Completed sales are immutable. Use the returns workflow to correct mistakes while keeping an audit trail.",
      },
      {
        question: "Does POS support wholesale packs?",
        answer:
          "Yes when multi-unit pricing is enabled for your organization. Sell by pack, carton, or unit from the same product.",
      },
    ],
    related: [
      { href: "/product/inventory", label: "Inventory" },
      { href: "/product/offline-sync", label: "Offline & Sync" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  inventory: {
    slug: "inventory",
    eyebrow: "Inventory",
    title: "Know what is in stock",
    summary:
      "Track catalogue, quantities, low stock, and valuation in one place—then import or adjust with a clear audit trail.",
    problem:
      "Guesswork on shelf levels leads to stockouts, overbuying, and arguments between counter and warehouse. Novend keeps one catalogue with attributable stock history.",
    heroImage: FEATURE_BLOCK_SCREENS.inventory,
    heroAlt: "Novend inventory stock table",
    outcome: "Replace guesswork with a catalogue your counter and warehouse can trust.",
    workflow: [
      {
        title: "Build the catalogue",
        detail:
          "Create products with SKUs, barcodes, pricing, categories, and optional images—unique per organization.",
      },
      {
        title: "Receive and adjust",
        detail:
          "Record receives, damages, counts, and other adjustments with reasons so every quantity change stays attributable.",
      },
      {
        title: "Import at scale",
        detail: "Bring catalogue rows in via CSV or Excel when you are migrating or adding a large list.",
      },
      {
        title: "Watch thresholds",
        detail: "Surface low-stock items before shelves go empty, then act from the same inventory views.",
      },
    ],
    capabilities: [
      "SKU and barcode catalogue",
      "Stock adjustments with history",
      "Low-stock visibility and thresholds",
      "CSV and Excel import",
      "Product detail with expiry lots where enabled",
      "Supplier links for receiving workflows",
    ],
    deepDives: [
      {
        title: "Stock you can explain",
        detail:
          "Every quantity change records a business reason. Managers can open product detail and see what moved—and why.",
        image: MARKETING_UI_SCREENS.inventoryStock,
        imageAlt: "Novend inventory stock list",
      },
      {
        title: "Adjust without losing history",
        detail:
          "Use guided adjustment flows for counts, damage, and corrections. Inventory never becomes negative on the server.",
        image: MARKETING_UI_SCREENS.inventoryAdjustStockModal,
        imageAlt: "Novend adjust stock modal",
      },
      {
        title: "Import when the list is long",
        detail:
          "CSV and Excel import accelerate catalogue setup for pharmacies, wholesalers, and multi-category stores.",
        image: MARKETING_UI_SCREENS.inventoryProductImportModal,
        imageAlt: "Novend product import modal",
      },
    ],
    offlineNote:
      "Local stock views and adjustments continue offline after setup; organization-wide refresh happens after sync.",
    hardwareNote:
      "Desktop and web for catalogue admin; mobile for on-floor checks and quick lookups.",
    platforms: "Desktop and web for admin work; mobile for on-floor checks",
    faq: [
      {
        question: "Can inventory go negative?",
        answer:
          "No. Novend never allows stock to go below zero. Sales and adjustments that would oversell are rejected with a clear error.",
      },
      {
        question: "Do product changes rewrite old receipts?",
        answer:
          "No. Completed sales snapshot prices and quantities at checkout, so historical receipts stay accurate.",
      },
      {
        question: "How do I correct a stock mistake?",
        answer:
          "Use an inventory adjustment with a reason, or a return workflow when the correction follows a sale.",
      },
    ],
    related: [
      { href: "/product/branches", label: "Branches & Transfers" },
      { href: "/product/pos", label: "Point of Sale" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  branches: {
    slug: "branches",
    eyebrow: "Branches & transfers",
    title: "Move stock between locations",
    summary:
      "Run a warehouse and multiple branches with transfer history and quantities that stay accurate after sync.",
    problem:
      "Spreadsheets cannot keep warehouse, branch, and counter quantities aligned. Novend tracks stock per location and records every transfer.",
    heroImage: FEATURE_BLOCK_SCREENS.wholesale,
    heroAlt: "Novend wholesale and branch stock overview",
    outcome: "See what each location holds without rebuilding spreadsheets every week.",
    workflow: [
      {
        title: "Centralize receiving",
        detail: "Receive supplier stock into wholesale storage or the receiving branch with a clear purchase record.",
      },
      {
        title: "Transfer with history",
        detail: "Issue stock to branches and keep a transfer trail managers can audit later.",
      },
      {
        title: "Sell locally",
        detail: "Each counter sells from stock available at that location—no shared mystery quantity.",
      },
      {
        title: "Review by branch",
        detail: "Open branch detail for people, stock posture, and operational context for that site.",
      },
    ],
    capabilities: [
      "Warehouse and branch stock",
      "Branch transfers with history",
      "Quantity tracking by location",
      "Plan-based multi-branch limits",
      "Wholesale receive and issue flows",
      "Branch-aware reporting where entitled",
    ],
    deepDives: [
      {
        title: "Wholesale as the hub",
        detail:
          "Receive into central storage, then issue to branches when shops need replenishment.",
        image: MARKETING_UI_SCREENS.inventoryWholesale,
        imageAlt: "Novend wholesale inventory",
      },
      {
        title: "Transfers you can defend",
        detail:
          "Issue stock with quantities and destinations recorded so disputes between sites have a source of truth.",
        image: MARKETING_UI_SCREENS.inventoryWholesaleIssueModal,
        imageAlt: "Novend wholesale issue modal",
      },
      {
        title: "Branches as real places",
        detail:
          "Manage branch profiles and drill into a location when you need operational detail—not just a label on a filter.",
        image: MARKETING_UI_SCREENS.administrationBranches,
        imageAlt: "Novend branches administration",
      },
    ],
    offlineNote:
      "Branch transfers and local stock operations continue on-device after setup; other locations refresh after sync.",
    hardwareNote:
      "Desktop is best for transfers and receiving. Counters can use desktop or mobile for selling from local stock.",
    platforms: "Best on desktop for transfers; counters can use desktop or mobile",
    faq: [
      {
        question: "Is multi-branch on every plan?",
        answer:
          "No. Branch count and transfer entitlements follow your plan. Compare limits on the pricing page.",
      },
      {
        question: "Can two branches share one stock pool?",
        answer:
          "Stock is tracked per branch. Transfers move quantity between locations with history.",
      },
      {
        question: "What happens offline during a transfer?",
        answer:
          "On-device transfer work continues after setup. Other locations see updated quantities after sync.",
      },
    ],
    related: [
      { href: "/product/inventory", label: "Inventory" },
      { href: "/product/reports", label: "Reports" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  reports: {
    slug: "reports",
    eyebrow: "Reports",
    title: "Make decisions with evidence",
    summary:
      "Review revenue, margin, stock valuation, and exports from views that update locally as you work and refresh after sync.",
    problem:
      "Owners should not wait until month-end to learn what sold, what margin remained, or which branch underperformed.",
    heroImage: FEATURE_BLOCK_SCREENS.reports,
    heroAlt: "Novend business reports screen",
    outcome: "Leave the day with printable and exportable proof—not a guess.",
    workflow: [
      {
        title: "Review the day",
        detail: "Open sales and inventory views for the period you care about, including day-level breakdowns.",
      },
      {
        title: "Inspect the detail",
        detail: "Drill from summary into day or metric detail when a number needs explanation.",
      },
      {
        title: "Export what you need",
        detail: "Download CSV on every plan; Excel and PDF on Pro and above for accountants and owners.",
      },
      {
        title: "Share with the team",
        detail: "Print or export for owners, accountants, and branch managers without rebuilding sheets by hand.",
      },
    ],
    capabilities: [
      "Sales and inventory reports",
      "Daily breakdown and day detail",
      "CSV exports on every plan",
      "Excel and PDF on Pro and above",
      "Branch-aware reporting where entitled",
      "Analytics views for revenue, expenses, and P&L context",
    ],
    deepDives: [
      {
        title: "Reports for the working day",
        detail:
          "Start from business reports, then open daily breakdowns when you need the story behind the totals.",
        image: MARKETING_UI_SCREENS.businessReports,
        imageAlt: "Novend business reports",
      },
      {
        title: "Analytics beside reports",
        detail:
          "Review revenue posture and expense context without leaving the business suite—useful for weekly owner reviews.",
        image: MARKETING_UI_SCREENS.businessAnalyticsOverview,
        imageAlt: "Novend analytics overview",
      },
      {
        title: "Day-level clarity",
        detail:
          "Open a specific day when a cashier, branch, or promotion needs a closer look.",
        image: MARKETING_UI_SCREENS.businessReportsDayDetail,
        imageAlt: "Novend day detail report",
      },
    ],
    offlineNote:
      "Dashboards update from local data while you work; connected devices refresh after synchronization.",
    hardwareNote: "Desktop and web for deep reporting; mobile for quick checks between sites.",
    platforms: "Desktop and web for deep reporting; mobile for quick checks",
    faq: [
      {
        question: "Which export formats are included?",
        answer:
          "CSV is available on every plan. Excel and PDF exports are included on Pro and above.",
      },
      {
        question: "Are reports branch-aware?",
        answer:
          "Yes where your plan and role entitle branch scope. Cashiers see the history they are allowed to see.",
      },
      {
        question: "Do offline sales appear immediately?",
        answer:
          "Local views update as you work on the device. Organization-wide refresh completes after sync.",
      },
    ],
    related: [
      { href: "/product/pos", label: "Point of Sale" },
      { href: "/product/offline-sync", label: "Offline & Sync" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  "offline-sync": {
    slug: "offline-sync",
    eyebrow: "Offline & sync",
    title: "Built for unreliable connectivity",
    summary:
      "After setup, the counter keeps working on the device. Pending changes upload when you reconnect—without stopping the sale in front of you.",
    problem:
      "Retail in intermittent networks cannot treat the cloud as a hard dependency for every scan. Novend is local-first for core operations after setup.",
    heroImage: MARKETING_UI_SCREENS.salesPos,
    heroAlt: "Novend POS ready for offline selling",
    outcome: "Treat connectivity as optional for core selling—not as a dependency.",
    workflow: [
      {
        title: "Sell on device",
        detail: "Completed sales write locally first so the cashier is not blocked by a dead radio.",
      },
      {
        title: "Save locally",
        detail: "Stock movements and receipts stay on the device during an outage.",
      },
      {
        title: "Queue safely",
        detail: "Pending operations wait in an outbox with clear status instead of silent loss.",
      },
      {
        title: "Sync on reconnect",
        detail:
          "When connectivity returns, queued work uploads and connected views refresh. Conflicts surface with guidance.",
      },
    ],
    capabilities: [
      "Offline selling after setup",
      "Local-first sale and stock writes",
      "Background sync on reconnect",
      "Clear conflict handling when devices disagree",
      "Sync activity visibility for managers",
      "Honest limits: auth and billing still need the network",
    ],
    deepDives: [
      {
        title: "Keep the counter open",
        detail:
          "The sales screen remains usable offline after setup. Cashiers finish the person in front of them first.",
        image: MARKETING_UI_SCREENS.salesPos,
        imageAlt: "Novend POS during offline-capable selling",
      },
      {
        title: "See what synced",
        detail:
          "Managers can review recent sync activity instead of guessing whether last night’s sales reached the cloud.",
        image: MARKETING_UI_SCREENS.syncRecent,
        imageAlt: "Novend recent sync activity",
      },
      {
        title: "Stock stays coherent",
        detail:
          "Local stock views remain available while offline; server authority reconciles when devices reconnect.",
        image: MARKETING_UI_SCREENS.inventoryStock,
        imageAlt: "Novend inventory during local operation",
      },
    ],
    offlineNote:
      "Qualification: core selling and local operations continue offline after initial setup. Sign-in, billing, device activation, and some account actions still need connectivity.",
    hardwareNote:
      "Desktop counters preferred for hardware. Android and PWA cover mobility. Register the device while online before relying on offline mode.",
    platforms: "Desktop counters preferred for hardware; Android and PWA for mobility",
    faq: [
      {
        question: "What still needs internet?",
        answer:
          "First-time sign-in, billing, device activation, password reset, and some account administration require connectivity.",
      },
      {
        question: "What if two devices change the same stock?",
        answer:
          "Sync uses queue order plus server validation. Conflicts surface in Sync Center with fix/retry guidance.",
      },
      {
        question: "How long can we run offline?",
        answer:
          "Core selling continues after setup for as long as the local session and licence allow. Reconnect regularly so backups and org views stay current.",
      },
    ],
    related: [
      { href: "/product/pos", label: "Point of Sale" },
      { href: "/download", label: "Download" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
};

export const PRODUCT_PAGE_SLUGS = Object.keys(PRODUCT_PAGES) as ProductPageSlug[];

export function getProductPage(slug: string): ProductPageContent | null {
  if (slug in PRODUCT_PAGES) return PRODUCT_PAGES[slug as ProductPageSlug];
  return null;
}
