import { FEATURE_BLOCK_SCREENS, MARKETING_UI_SCREENS } from "@/constants/marketing-ui-screens";

export type ProductPageSlug = "pos" | "inventory" | "branches" | "reports" | "offline-sync";

export type ProductPageContent = {
  slug: ProductPageSlug;
  eyebrow: string;
  title: string;
  summary: string;
  heroImage: string;
  heroAlt: string;
  outcome: string;
  workflow: ReadonlyArray<{ title: string; detail: string }>;
  capabilities: ReadonlyArray<string>;
  offlineNote: string;
  platforms: string;
  related: ReadonlyArray<{ href: string; label: string }>;
};

export const PRODUCT_PAGES: Record<ProductPageSlug, ProductPageContent> = {
  pos: {
    slug: "pos",
    eyebrow: "Point of sale",
    title: "Sell without interruption",
    summary:
      "Barcode-ready checkout, hold and resume, receipts, and offline selling after setup—so an outage does not close the counter.",
    heroImage: FEATURE_BLOCK_SCREENS.checkout,
    heroAlt: "Novend POS checkout with catalog and cart",
    outcome: "Keep the queue moving with a counter built for everyday retail speed.",
    workflow: [
      {
        title: "Scan or search",
        detail: "Add items by barcode or catalog search, then adjust quantities quickly.",
      },
      {
        title: "Take payment",
        detail: "Complete the sale with one payment method, then print or share the receipt.",
      },
      {
        title: "Keep selling offline",
        detail: "After setup, core selling continues on the device when the network drops.",
      },
    ],
    capabilities: [
      "Barcode-ready checkout",
      "Hold and resume sales",
      "Receipt printing options",
      "Offline selling after setup",
    ],
    offlineNote:
      "Core checkout continues offline after initial setup. Sign-in, billing, and some account actions still need connectivity.",
    platforms: "Windows, macOS, Linux, Android, web, and iPhone/iPad PWA",
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
    heroImage: FEATURE_BLOCK_SCREENS.inventory,
    heroAlt: "Novend inventory stock table",
    outcome: "Replace guesswork with a catalogue your counter and warehouse can trust.",
    workflow: [
      {
        title: "Build the catalogue",
        detail: "Create products with SKUs, barcodes, pricing, and categories.",
      },
      {
        title: "Receive and adjust",
        detail: "Record stock changes with reasons so history stays attributable.",
      },
      {
        title: "Watch thresholds",
        detail: "Surface low-stock items before shelves go empty.",
      },
    ],
    capabilities: [
      "SKU and barcode catalogue",
      "Stock adjustments with history",
      "Low-stock visibility",
      "CSV and Excel import",
    ],
    offlineNote:
      "Local stock views and adjustments continue offline after setup; organization-wide refresh happens after sync.",
    platforms: "Desktop and web for admin work; mobile for on-floor checks",
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
    heroImage: FEATURE_BLOCK_SCREENS.wholesale,
    heroAlt: "Novend wholesale and branch stock overview",
    outcome: "See what each location holds without rebuilding spreadsheets every week.",
    workflow: [
      {
        title: "Centralize receiving",
        detail: "Receive supplier stock into wholesale or the right branch.",
      },
      {
        title: "Transfer with history",
        detail: "Issue stock to branches and keep a clear transfer record.",
      },
      {
        title: "Sell locally",
        detail: "Each counter sells from the stock available at that location.",
      },
    ],
    capabilities: [
      "Warehouse and branch stock",
      "Branch transfers with history",
      "Quantity tracking by location",
      "Plan-based multi-branch limits",
    ],
    offlineNote:
      "Branch transfers and local stock operations continue on-device after setup; other locations refresh after sync.",
    platforms: "Best on desktop for transfers; counters can use desktop or mobile",
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
    heroImage: FEATURE_BLOCK_SCREENS.reports,
    heroAlt: "Novend business reports screen",
    outcome: "Leave the day with printable and exportable proof—not a guess.",
    workflow: [
      {
        title: "Review the day",
        detail: "Open sales and inventory views for the period you care about.",
      },
      {
        title: "Export what you need",
        detail: "Download CSV on every plan; Excel and PDF on Pro and above.",
      },
      {
        title: "Share with the team",
        detail: "Print or export for owners, accountants, and branch managers.",
      },
    ],
    capabilities: [
      "Sales and inventory reports",
      "CSV exports on every plan",
      "Excel and PDF on Pro and above",
      "Branch-aware reporting where entitled",
    ],
    offlineNote:
      "Dashboards update from local data while you work; connected devices refresh after synchronization.",
    platforms: "Desktop and web for deep reporting; mobile for quick checks",
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
    heroImage: MARKETING_UI_SCREENS.salesPos,
    heroAlt: "Novend POS ready for offline selling",
    outcome: "Treat connectivity as optional for core selling—not as a dependency.",
    workflow: [
      {
        title: "Sell on device",
        detail: "Completed sales write locally first.",
      },
      {
        title: "Save locally",
        detail: "Stock and receipts stay on the device during an outage.",
      },
      {
        title: "Sync safely",
        detail: "When you reconnect, queued work uploads and connected views refresh.",
      },
    ],
    capabilities: [
      "Offline selling after setup",
      "Local-first sale and stock writes",
      "Background sync on reconnect",
      "Clear conflict handling when devices disagree",
    ],
    offlineNote:
      "Qualification: core selling and local operations continue offline after initial setup. Sign-in, billing, and some account actions still need connectivity.",
    platforms: "Desktop counters preferred for hardware; Android and PWA for mobility",
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
