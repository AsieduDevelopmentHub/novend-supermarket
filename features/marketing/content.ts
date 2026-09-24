import { APP_BRAND, APP_TAGLINE } from "@/constants/app";

export const LANDING_CONTACT_EMAIL = "asiedudev.hub@gmail.com";

/** Build a mailto URL with subject + body for sales outreach.
 * Uses encodeURIComponent (%20) — URLSearchParams uses +, which many mail clients show literally.
 */
export function buildSalesMailto(options: { subject: string; body: string }): string {
  return (
    `mailto:${LANDING_CONTACT_EMAIL}` +
    `?subject=${encodeURIComponent(options.subject)}` +
    `&body=${encodeURIComponent(options.body)}`
  );
}

export const ENTERPRISE_SALES_MAILTO = buildSalesMailto({
  subject: "Novend Enterprise Plan Inquiry",
  body: [
    "Hello Novend Sales Team,",
    "",
    "I am interested in the Novend Enterprise plan for my organization.",
    "",
    "Please find my details below:",
    "",
    "Business / organization name:",
    "Industry (pharmacy, supermarket, wholesale, retail chain, other):",
    "Number of branches / locations:",
    "Approximate products / SKUs:",
    "Number of users / cashiers:",
    "Preferred billing (Monthly / Yearly):",
    "Current POS or inventory system (if any):",
    "Go-live timeline:",
    "Additional requirements:",
    "",
    "Please share Enterprise pricing, onboarding, and next steps.",
    "",
    "Thank you,",
    "Full name:",
    "Phone / WhatsApp:",
    "Email:",
  ].join("\n"),
});

/** General Contact Sales — not plan-specific (final CTA / general outreach). */
export const GENERAL_SALES_MAILTO = buildSalesMailto({
  subject: "Novend Sales Inquiry",
  body: [
    "Hello Novend Sales Team,",
    "",
    "I would like to learn more about Novend for my business.",
    "",
    "Please find my details below:",
    "",
    "Business / organization name:",
    "Industry:",
    "What I need help with (demo, pricing, onboarding, other):",
    "Preferred plan interest (Basic / Pro / Enterprise / Lifetime / not sure):",
    "Number of branches / locations:",
    "Preferred contact method (email / phone / WhatsApp):",
    "",
    "Thank you,",
    "Full name:",
    "Phone / WhatsApp:",
    "Email:",
  ].join("\n"),
});

export const landingCopy = {
  brand: APP_BRAND,
  tagline: APP_TAGLINE,
  hero: {
    eyebrow: "Offline-first POS for modern retail",
    headlineLead: "Keep selling—even when the",
    headlineAccent: "internet stops",
    headlineTrail: ".",
    subhead:
      "Novend brings checkout, inventory, branch transfers, and reporting into one dependable system built for everyday retail.",
    primaryCta: "Start free for 14 days",
    secondaryCta: "Explore the product",
    secondaryHref: "/#product",
    proofRow: ["No card required", "Works offline after setup", "Desktop and mobile"],
  },
  proofStrip: {
    items: [
      { id: "offline" as const, label: "Works offline" },
      { id: "branches" as const, label: "Multi-branch inventory" },
      { id: "platforms" as const, label: "Cross-platform" },
      { id: "backup" as const, label: "Encrypted backup traffic" },
    ],
  },
  /** @deprecated Prefer proofStrip — kept so older imports do not crash during transition. */
  trustStrip: {
    label: "Built for pharmacies, supermarkets, wholesalers, and multi-branch retailers",
    labels: ["Pharmacy", "Supermarket", "Wholesale", "Fashion & specialty"],
  },
  editorial: [
    {
      id: "checkout" as const,
      anchor: "product-pos",
      eyebrow: "Point of sale",
      title: "Sell without interruption",
      detail:
        "Keep the counter moving with barcode scanning, hold and resume, receipts, and a clear offline status—so an outage does not become a closed shop.",
      bullets: [
        "Fast barcode checkout with one payment method per sale",
        "Hold and resume carts when a customer needs a moment",
        "Core selling continues offline after setup",
      ],
      linkLabel: "See checkout in context",
      linkHref: "/#offline-sync",
    },
    {
      id: "inventory" as const,
      anchor: "product-inventory",
      eyebrow: "Inventory & branches",
      title: "Know what is in every location",
      detail:
        "Track warehouse and branch stock in one system. Transfer inventory with history, spot low stock early, and keep quantities accurate across locations.",
      bullets: [
        "Warehouse and branch stock in one catalogue",
        "Transfers with quantity tracking and history",
        "Low-stock visibility before shelves go empty",
      ],
      linkLabel: "Browse industries",
      linkHref: "/#industries",
    },
    {
      id: "reports" as const,
      anchor: "product-reports",
      eyebrow: "Reports & evidence",
      title: "Make decisions with evidence",
      detail:
        "Review revenue, margin, stock valuation, and exports from views that update from local work and refresh after sync on connected devices.",
      bullets: [
        "Revenue and margin views for the working day",
        "Stock valuation tied to your catalogue",
        "CSV exports on every plan; Excel and PDF on Pro and above",
      ],
      linkLabel: "Compare plans",
      linkHref: "/#pricing",
    },
  ],
  offlineFlow: {
    eyebrow: "Offline & sync",
    title: "Built for unreliable connectivity",
    detail:
      "After setup, the counter keeps working on the device. Pending changes upload when you reconnect—without stopping the sale in front of you.",
    steps: [
      {
        id: "write",
        title: "Sell on device",
        detail: "Each completed sale and stock change is recorded on the counter first.",
      },
      {
        id: "operate",
        title: "Save locally",
        detail: "Core selling and local operations continue when the network drops.",
      },
      {
        id: "sync",
        title: "Reconnect",
        detail: "When connectivity returns, queued work is ready to upload.",
      },
      {
        id: "refresh",
        title: "Sync safely",
        detail: "Pending changes upload in the background and connected views refresh.",
      },
    ],
    statusStrip: {
      operational: "Counter operational",
      queue: "Sync queue ready",
      connected: "Last connected when online",
    },
    qualification:
      "Qualification: core selling and local operations continue offline after initial setup. Sign-in, billing, and some account actions still need connectivity.",
  },
  /** Retained for legacy showcase components not used on the homepage. */
  howItWorks: {
    badge: "How Novend Works",
    title: "A smarter way to run your business",
    subtitle:
      "From stocking your warehouse to selling at the counter — Novend keeps every step connected.",
    steps: [
      {
        id: "products",
        number: "01",
        title: "Add products & stock",
        detail:
          "Create your catalog, set prices, and receive supplier deliveries into your warehouse.",
      },
      {
        id: "distribute",
        number: "02",
        title: "Distribute to branches",
        detail: "Transfer inventory to store locations with full tracking and accurate quantities.",
      },
      {
        id: "sell",
        number: "03",
        title: "Sell at the counter",
        detail: "Scan barcodes, take payments, and print receipts — including offline after setup.",
      },
      {
        id: "sync",
        number: "04",
        title: "Sync & stay updated",
        detail: "When you reconnect, sales and stock changes sync so connected dashboards refresh.",
      },
    ],
    diagramLabels: [
      { id: "warehouse", title: "Warehouse", detail: "Central stock & receiving" },
      { id: "branch", title: "Branch", detail: "Store-level inventory" },
      { id: "pos", title: "POS counter", detail: "Sell offline & sync later" },
    ],
  },
  architecture: {
    badge: "Built for the real world",
    title: "Offline-first. Always dependable.",
    subtitle:
      "After setup, core selling and local operations continue on the device when the network drops. Pending work uploads in the background when you reconnect — without interrupting the counter.",
    flow: [
      {
        id: "device",
        title: "Work offline",
        label: "Step 01",
        detail: "Keep selling and managing stock on this device when the internet is down.",
      },
      {
        id: "local",
        title: "Save locally",
        label: "Step 02",
        detail: "Every sale, receipt, and stock change is written on the device first.",
      },
      {
        id: "sync",
        title: "Automatically sync",
        label: "Step 03",
        detail:
          "When you reconnect, pending work uploads in the background without interrupting the counter.",
      },
      {
        id: "dashboard",
        title: "Stay updated",
        label: "Step 04",
        detail:
          "Dashboards update from local data while you work, then refresh after sync on connected devices.",
      },
    ],
    guarantees: [
      {
        id: "selling",
        title: "Works offline",
        detail: "Core selling and local ops continue offline after setup.",
      },
      {
        id: "backup",
        title: "Auto sync",
        detail: "Background upload when you reconnect.",
      },
      {
        id: "ownership",
        title: "Data protected",
        detail: "Cloud traffic and encrypted backups; local ops data uses device security.",
      },
      {
        id: "branches",
        title: "Conflict handling",
        detail: "Clear resolution when devices disagree.",
      },
    ],
    metrics: [
      { label: "Checkout", value: "Instant" },
      { label: "Selling offline", value: "After setup" },
      { label: "Background sync", value: "Automatic" },
      { label: "Branch support", value: "Plan-based" },
    ],
    syncCycle: {
      sale: "New sale recorded",
      pending: "3 Pending",
      synced: "Synced",
      offline: "Working offline",
      reconnect: "Connection restored",
      uploading: "Uploading quietly…",
      dashboard: "Dashboard updated",
    },
  },
  features: {
    badge: "Complete business platform",
    title: "Everything you need to run a modern store",
    subtitle:
      "Checkout, inventory, wholesale, analytics, and reports — the screens that matter for day-to-day retail.",
    blocks: [
      {
        id: "checkout",
        title: "Smart checkout built for speed",
        detail:
          "Complete sales in seconds with barcode scanning, discounts, one payment method per sale, and receipt printing — including while offline after setup.",
        bullets: [
          "Barcode ready",
          "Cash, card & mobile money",
          "Hold & resume sales",
          "Offline checkout",
        ],
      },
      {
        id: "inventory",
        title: "Inventory without guesswork",
        detail:
          "Track stock movement, valuation, adjustments, batches, and low-stock alerts. Bring an existing catalog in with CSV or Excel import.",
        bullets: ["CSV & Excel import", "Stock adjustments", "Low stock alerts", "SKU & barcode"],
      },
      {
        id: "wholesale",
        title: "One warehouse. Multiple branches.",
        detail:
          "Separate wholesale inventory from branch stock while maintaining complete transfer history and accurate quantities.",
        bullets: ["Wholesale storage", "Branch transfers", "Transfer history", "Quantity tracking"],
      },
      {
        id: "analytics",
        title: "See your business at a glance",
        detail:
          "Monitor revenue, profit, inventory value, customer growth, and best sellers on dashboards that update locally as you work and refresh after sync.",
        bullets: ["Revenue insights", "Profit tracking", "Category performance", "Best sellers"],
      },
      {
        id: "reports",
        title: "Professional reports in one click",
        detail:
          "Generate printable sales, inventory, returns, expenses, and branch reports, then export CSV, Excel, or PDF for review and submission.",
        bullets: ["CSV exports", "Excel & PDF", "Inventory reports", "Branch reports"],
      },
    ],
  },
  industries: {
    badge: "Industries",
    title: "Built for how your store actually works",
    subtitle:
      "Select an industry to see the checkout context and the capabilities that matter most for that workflow.",
    items: [
      {
        id: "pharmacy",
        pill: "Pharmacy",
        title: "Pharmacy counters",
        detail:
          "Dispense with batch tracking, expiry alerts, and barcode-ready checkout. Novend does not provide clinical, prescribing, or regulatory decision support.",
        capabilities: [
          "Medicine inventory & batches",
          "Expiry tracking & alerts",
          "Barcode dispensing",
        ],
        cta: "Start free trial",
      },
      {
        id: "supermarket",
        pill: "Supermarket",
        title: "High-volume retail",
        detail:
          "Keep busy counters moving with fast barcode checkout, category browsing, and receipts that print when you need them.",
        capabilities: ["Fast barcode checkout", "Category browsing", "Hold & resume sales"],
        cta: "Start free trial",
      },
      {
        id: "wholesale",
        pill: "Wholesale",
        title: "Warehouse to branch",
        detail:
          "Run a central warehouse, issue stock to branches, and keep supplier deliveries accurate.",
        capabilities: ["Wholesale storage", "Branch transfers", "Supplier deliveries"],
        cta: "Start free trial",
      },
      {
        id: "fashion",
        pill: "Fashion",
        title: "Boutique retail",
        detail: "Sell with product imagery, variation-aware stock, and boutique-ready receipts.",
        capabilities: ["Size & color variants", "Product imagery", "Stock by variation"],
        cta: "Start free trial",
      },
      {
        id: "electronics",
        pill: "Electronics",
        title: "High-value SKUs",
        detail:
          "Track serials and SKUs carefully, protect high-value inventory, and keep product detail close to every sale.",
        capabilities: ["Serial / SKU control", "High-value inventory", "Precise stock counts"],
        cta: "Start free trial",
      },
    ],
  },
  researchProof: {
    eyebrow: "Built with local retailers",
    title: "Designed from counter realities—not invented testimonials",
    detail:
      "Novend is shaped around pharmacies, provision shops, wholesalers, and multi-branch retailers operating with intermittent connectivity. Verified customer stories will appear here when we have permission to publish them.",
  },
  pricingPreview: {
    eyebrow: "Pricing",
    title: "Clear plans for how you grow",
    detail:
      "Every plan includes offline POS after setup, barcode support, receipts, inventory, and cloud sync. Compare limits and backup entitlements on the full pricing page.",
    summaries: {
      basic: "For single-location shops that need a dependable counter and catalogue.",
      pro: "For pharmacies, supermarkets, and growing wholesalers that need branches and transfers.",
      enterprise: "For chains and distributors that need custom limits, onboarding, and support.",
    },
    lifetime: {
      title: "Lifetime license",
      detail:
        "A one-time purchase path with unlimited operational capacity and one year of updates and premium support included. Purchasing differs from subscriptions—see full pricing for terms.",
      cta: "View lifetime details",
    },
    compareCta: "Compare all features",
    enterpriseHref: ENTERPRISE_SALES_MAILTO,
  },
  pricing: {
    badge: "Pricing",
    title: "Simple, transparent pricing",
    subtitle:
      "Every plan includes offline POS, barcode support, receipt printing, inventory, and cloud sync. Limits and cloud backup match the published catalog — upgrade only as you grow.",
    trialNote: "14-day free trial",
    cards: {
      basic: {
        badge: "Starter",
        description: "For provision shops, boutiques, salons, and small retail businesses.",
        included: [
          "Offline POS",
          "Inventory",
          "Barcode",
          "Receipt printing",
          "Reports",
          "Analytics",
        ],
        cta: "Start free trial",
        href: "/signup",
      },
      pro: {
        badge: "Recommended",
        description:
          "Built for supermarkets, pharmacies, electronics stores, and growing wholesalers.",
        additional: [
          "Wholesale inventory",
          "Branch transfers",
          "Multi-branch management",
          "Advanced analytics",
          "Priority support",
        ],
        cta: "Start free trial",
        href: "/signup",
      },
      enterprise: {
        badge: "Custom",
        description:
          "Designed for distributors, retail chains, and organizations operating at enterprise scale.",
        cta: "Contact sales",
        href: ENTERPRISE_SALES_MAILTO,
      },
      lifetime: {
        badge: "One-time license",
        description:
          "Own Novend permanently with unlimited operational capacity and 1 year of updates and premium support included.",
        includes: [
          "Unlimited products",
          "Unlimited users",
          "Unlimited branches",
          "Unlimited devices",
          "1 GB cloud backup",
          "1 year updates & support",
        ],
        cta: "Buy lifetime",
        href: "/signup",
      },
    },
    includedEveryPlan: [
      "Offline POS",
      "Barcode scanner",
      "Receipt printing",
      "Inventory",
      "Customers",
      "Suppliers",
      "Returns",
      "Analytics",
    ],
    trust: [
      { title: "No setup fees", detail: "Start without hidden costs" },
      { title: "Cancel anytime", detail: "No long-term lock-in" },
      { title: "Secure sync", detail: "Encrypted cloud traffic & backups" },
      { title: "Free updates", detail: "During your plan term" },
    ],
  },
  faq: {
    badge: "FAQ",
    title: "Questions retailers ask first",
    contactTitle: "Still have questions?",
    contactDetail: "Contact our support team anytime.",
    contactCta: "Contact support",
    contactHref: GENERAL_SALES_MAILTO,
    items: [
      {
        q: "Does Novend work offline?",
        a: "Yes. After setup and activation, core selling and local operations continue on the device without internet. Sign-in, billing, and some account actions need connectivity. When you reconnect, pending work synchronizes automatically.",
      },
      {
        q: "Can I upgrade my plan later?",
        a: "Yes. Your products, customers, branches, and sales remain intact during upgrades.",
      },
      {
        q: "Can I import my existing inventory?",
        a: "Yes. Administrators and managers can import products from CSV or Excel. Download a template, map your columns, preview creates and updates, then import. Opening stock applies to new products only, and your plan’s product limit still applies.",
      },
      {
        q: "Can I export reports and product lists?",
        a: "Yes. Reports and catalogs download as CSV on every plan. Excel and PDF exports are included on Pro and above, and you can still print from the same views.",
      },
      {
        q: "Does Novend support barcode scanners and receipt printers?",
        a: "Yes. Camera scanning, hardware barcode scanners, and thermal receipt printing are supported.",
      },
      {
        q: "Does Novend work on phones and tablets?",
        a: "Yes. Download the Android app from the Download page. On iPhone and iPad, open Novend in Safari and add it to your Home Screen as a PWA. Use the desktop app on the counter when you need printers and barcode hardware.",
      },
    ],
  },
  cta: {
    title: "Ready for a calmer counter?",
    subtitle: "Set up your catalogue, make a test sale, and see how Novend handles a working day.",
    primary: "Start free",
    secondary: "Talk to sales",
    secondaryHref: GENERAL_SALES_MAILTO,
    platformsLine: "Windows • macOS • Linux • Android • iPhone/iPad PWA",
  },
  desktop: {
    id: "desktop",
    badge: "Apps & downloads",
    title: "One account on every counter and in every pocket",
    detail:
      "Desktop for Windows, macOS, and Linux. Android for phones and tablets. On iPhone and iPad, add Novend to your Home Screen as a PWA.",
    platforms: [
      { id: "desktop", label: "Windows, macOS & Linux" },
      { id: "android", label: "Android app" },
      { id: "ios", label: "iPhone & iPad (PWA)" },
    ],
    cta: "Go to downloads",
    href: "/download",
  },
  nav: {
    product: {
      label: "Product",
      items: [
        { href: "/#product-pos", label: "Point of Sale" },
        { href: "/#product-inventory", label: "Inventory" },
        { href: "/#product-inventory", label: "Branches & Transfers" },
        { href: "/#product-reports", label: "Reports" },
        { href: "/#offline-sync", label: "Offline & Sync" },
      ],
    },
    industries: {
      label: "Industries",
      items: [
        { href: "/#industry-pharmacy", label: "Pharmacy" },
        { href: "/#industry-supermarket", label: "Supermarket" },
        { href: "/#industry-wholesale", label: "Wholesale" },
        { href: "/#industry-fashion", label: "Fashion & Specialty Retail" },
        { href: "/#industry-electronics", label: "Electronics" },
      ],
    },
    pricing: { href: "/pricing", label: "Pricing" },
    resources: {
      label: "Resources",
      items: [
        { href: "/docs/help", label: "Help Center" },
        { href: "/docs", label: "Documentation" },
        { href: "/docs/releases", label: "Release Notes" },
        // TODO(security-page): dedicated /security trust page
        { href: "/docs#security", label: "Security" },
      ],
    },
    desktop: { href: "/download", label: "Download" },
  },
  navTrialCta: "Start free",
  footer: {
    brandTitle: "Novend by Asiedu Development Hub",
    description:
      "Commercial POS for pharmacies, supermarkets, wholesalers, and multi-branch retailers.",
    product: [
      { href: "/#product-pos", label: "Point of Sale" },
      { href: "/#product-inventory", label: "Inventory" },
      { href: "/#offline-sync", label: "Offline & Sync" },
      { href: "/pricing", label: "Pricing" },
      { href: "/download", label: "Download" },
    ],
    industries: [
      { href: "/#industry-pharmacy", label: "Pharmacy" },
      { href: "/#industry-supermarket", label: "Supermarket" },
      { href: "/#industry-wholesale", label: "Wholesale" },
      { href: "/#industry-fashion", label: "Fashion & Specialty" },
      { href: "/#industry-electronics", label: "Electronics" },
    ],
    resources: [
      { href: "/docs", label: "Documentation" },
      { href: "/docs/help", label: "Help Center" },
      { href: "/docs/releases", label: "Release Notes" },
      { href: GENERAL_SALES_MAILTO, label: "Contact Support" },
    ],
    legal: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/refund", label: "Refund Policy" },
      { href: "/cookies", label: "Cookie Policy" },
      { href: "/aup", label: "Acceptable Use" },
      { href: "/dpa", label: "Data Processing" },
    ],
    contact: {
      title: "Contact",
      email: {
        label: "Email",
        value: LANDING_CONTACT_EMAIL,
        href: `mailto:${LANDING_CONTACT_EMAIL}`,
      },
      international: {
        label: "WhatsApp (UK)",
        value: "+44 7868 178108",
        href: "https://wa.me/447868178108",
      },
      local: {
        label: "Calls & WhatsApp (Ghana)",
        value: "+233 55 525 7482",
        href: "tel:+233555257482",
      },
      location: {
        label: "Location",
        value: "Sunyani, Bono Region, Ghana",
      },
    },
    copyright: "Novend. All rights reserved.",
    builtBy: "Designed & developed by Asiedu Development Hub",
  },
} as const;
