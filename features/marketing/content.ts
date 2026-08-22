import { APP_BRAND, APP_TAGLINE } from "@/constants/app";

export const LANDING_CONTACT_EMAIL = "asiedudev.hub@gmail.com";

/** Build a mailto URL with subject + body for sales outreach.
 * Uses encodeURIComponent (%20) — URLSearchParams uses +, which many mail clients show literally.
 */
export function buildSalesMailto(options: {
  subject: string;
  body: string;
}): string {
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
    badge: "Offline-First POS & Inventory System",
    /** Headline parts — Candy Blue accents on key phrases in the UI. */
    headlineLead: "Run Your Business.",
    headlineAccent: "Anywhere.",
    subhead:
      "Sell, manage inventory, transfer stock between branches, and sync automatically when internet returns. Built for supermarkets, pharmacies, wholesalers, and modern retail businesses.",
    primaryCta: "Start Free Trial",
    secondaryCta: "Download App",
    secondaryHref: "/download",
    trustChips: [
      { id: "offline", label: "Offline First" },
      { id: "branches", label: "Multi-Branch" },
      { id: "secure", label: "Secure & Reliable" },
    ],
  },
  trustedBy: {
    title: "Trusted by growing businesses.",
    names: ["Pharmex", "Sunyani Mart", "QuickShop", "ElectroHub", "TrendWear"],
  },
  howItWorks: {
    badge: "How Novend Works",
    title: "A Smarter Way to Run Your Business",
    subtitle:
      "From stocking your warehouse to selling at the counter — Novend keeps every step connected.",
    steps: [
      {
        id: "products",
        number: "01",
        title: "Add Products & Stock",
        detail:
          "Create your catalog, set prices, and receive supplier deliveries into your warehouse.",
      },
      {
        id: "distribute",
        number: "02",
        title: "Distribute to Branches",
        detail:
          "Transfer inventory to store locations with full tracking and accurate quantities.",
      },
      {
        id: "sell",
        number: "03",
        title: "Sell at the Counter",
        detail:
          "Scan barcodes, take payments, and print receipts — even when the internet is down.",
      },
      {
        id: "sync",
        number: "04",
        title: "Sync & Stay Updated",
        detail:
          "When you reconnect, sales and stock changes sync to the cloud automatically.",
      },
    ],
    diagramLabels: [
      {
        id: "warehouse",
        title: "Warehouse",
        detail: "Central stock & receiving",
      },
      {
        id: "branch",
        title: "Branch",
        detail: "Store-level inventory",
      },
      {
        id: "pos",
        title: "POS Counter",
        detail: "Sell offline & sync later",
      },
    ],
  },
  architecture: {
    badge: "Built for the Real World",
    title: "Offline-First. Always Reliable.",
    subtitle:
      "Novend saves every sale, inventory update, customer, and receipt directly on your device. When internet becomes available, everything synchronizes automatically without interrupting business.",
    flow: [
      {
        id: "device",
        title: "Your Device",
        label: "Work locally",
        detail: "Sales, products and inventory stay available at all times.",
      },
      {
        id: "local",
        title: "Local Database",
        label: "Saved instantly",
        detail: "Every sale and stock change is written on the device before anything else.",
      },
      {
        id: "sync",
        title: "Smart Sync Engine",
        label: "Syncs quietly",
        detail: "When you reconnect, pending work uploads in the background.",
      },
      {
        id: "dashboard",
        title: "Cloud Database",
        label: "Access anywhere",
        detail: "Managers see branches, revenue, and stock from any connected device.",
      },
    ],
    guarantees: [
      {
        id: "selling",
        title: "Works Offline",
        detail: "100% operational without internet.",
      },
      {
        id: "backup",
        title: "Auto Sync",
        detail: "Seamless and fast when online.",
      },
      {
        id: "ownership",
        title: "Data Safe",
        detail: "Encrypted and stored securely.",
      },
      {
        id: "branches",
        title: "Conflict Handling",
        detail: "Smart resolution across devices.",
      },
    ],
    metrics: [
      { label: "Checkout", value: "Instant" },
      { label: "Internet Required", value: "No" },
      { label: "Background Sync", value: "Automatic" },
      { label: "Branch Support", value: "Enterprise Ready" },
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
    badge: "Complete Business Platform",
    title: "Everything You Need to Run a Modern Store",
    subtitle:
      "From checkout and barcode scanning to wholesale inventory and multi-branch management, Novend brings every business operation into one beautifully connected platform.",
    blocks: [
      {
        id: "checkout",
        title: "Smart Checkout Built for Speed",
        detail:
          "Complete sales in seconds using barcode scanning, discounts, multiple payment methods, and instant receipt printing—even while offline.",
        bullets: ["Barcode ready", "Split payments", "Hold & resume sales", "Offline checkout"],
      },
      {
        id: "inventory",
        title: "Inventory Without Guesswork",
        detail:
          "Track stock movement, valuation, adjustments, batches, and low-stock alerts from one centralized inventory system.",
        bullets: ["Stock adjustments", "Low stock alerts", "SKU & barcode", "Product images"],
      },
      {
        id: "wholesale",
        title: "One Warehouse. Multiple Branches.",
        detail:
          "Separate wholesale inventory from branch stock while maintaining complete transfer history and accurate quantities.",
        bullets: [
          "Wholesale storage",
          "Branch transfers",
          "Transfer history",
          "Quantity tracking",
        ],
      },
      {
        id: "analytics",
        title: "See Your Business at a Glance",
        detail:
          "Monitor revenue, profit, inventory value, customer growth, and best-selling products through beautiful real-time dashboards.",
        bullets: [
          "Revenue insights",
          "Profit tracking",
          "Category performance",
          "Best sellers",
        ],
      },
      {
        id: "relationships",
        title: "Build Stronger Customer & Supplier Relationships",
        detail:
          "Keep complete customer histories, supplier records, outstanding balances, and purchase activity in one connected system.",
        bullets: [
          "Customer history",
          "Supplier management",
          "Outstanding balances",
          "Notes & contacts",
        ],
      },
      {
        id: "reports",
        title: "Professional Reports in One Click",
        detail:
          "Generate printable sales, inventory, returns, expenses, and branch reports for smarter business decisions.",
        bullets: ["PDF exports", "Excel exports", "Inventory reports", "Branch reports"],
      },
    ],
  },
  industries: {
    badge: "Industries We Power",
    title: "Built for Every Kind of Retail Business.",
    subtitle:
      "Whether you manage a neighborhood pharmacy, a supermarket, a wholesale warehouse, or a fashion boutique, Novend adapts to how you operate.",
    items: [
      {
        id: "pharmacy",
        pill: "Pharmacy",
        title: "Pharmacy Solutions",
        detail:
          "Dispense with confidence using batch tracking, expiry alerts, and barcode-ready checkout built for regulated inventory.",
        capabilities: [
          "Medicine inventory & batches",
          "Expiry tracking & alerts",
          "Barcode dispensing",
          "Supplier restocking",
        ],
        cta: "Explore Pharmacy Demo",
        kpis: [
          { label: "Near expiry", value: "12" },
          { label: "SKUs tracked", value: "840" },
          { label: "Today’s scripts", value: "64" },
        ],
      },
      {
        id: "supermarket",
        pill: "Supermarket",
        title: "Supermarket Solutions",
        detail:
          "Keep high-volume counters moving with fast barcode checkout, category browsing, and instant receipts.",
        capabilities: [
          "Fast barcode checkout",
          "Category browsing",
          "Hold & resume sales",
          "Instant receipts",
        ],
        cta: "Explore Supermarket Demo",
        kpis: [
          { label: "Avg. checkout", value: "18s" },
          { label: "Categories", value: "36" },
          { label: "Open carts", value: "4" },
        ],
      },
      {
        id: "wholesale",
        pill: "Wholesale",
        title: "Wholesale Solutions",
        detail:
          "Run a central warehouse, issue stock to branches, and keep supplier deliveries accurate.",
        capabilities: [
          "Wholesale storage",
          "Branch transfers",
          "Supplier deliveries",
          "Bulk quantities",
        ],
        cta: "Explore Wholesale Demo",
        kpis: [
          { label: "Warehouse SKUs", value: "2.1k" },
          { label: "Open transfers", value: "7" },
          { label: "Branches", value: "5" },
        ],
      },
      {
        id: "fashion",
        pill: "Fashion",
        title: "Fashion Solutions",
        detail:
          "Sell by size and color with product imagery, variation stock, and boutique-ready receipts.",
        capabilities: [
          "Size & color variants",
          "Product imagery",
          "Stock by variation",
          "Boutique-ready receipts",
        ],
        cta: "Explore Fashion Demo",
        kpis: [
          { label: "Variants", value: "318" },
          { label: "Low stock", value: "9" },
          { label: "Looks sold", value: "27" },
        ],
      },
      {
        id: "electronics",
        pill: "Electronics",
        title: "Electronics Solutions",
        detail:
          "Track serials and SKUs carefully, protect high-value inventory, and keep product detail close to every sale.",
        capabilities: [
          "Serial / SKU control",
          "High-value inventory",
          "Product detail records",
          "Precise stock counts",
        ],
        cta: "Explore Electronics Demo",
        kpis: [
          { label: "Active SKUs", value: "1.4k" },
          { label: "High value", value: "86" },
          { label: "Adjustments", value: "3" },
        ],
      },
      {
        id: "convenience",
        pill: "Convenience Store",
        title: "Convenience Solutions",
        detail:
          "Keep a lean catalog, scan quickly, and stay selling through outages with low-stock alerts.",
        capabilities: [
          "Quick barcode checkout",
          "Lean product catalog",
          "Low-stock alerts",
          "Offline-ready till",
        ],
        cta: "Explore Convenience Demo",
        kpis: [
          { label: "Catalog size", value: "220" },
          { label: "Low stock", value: "14" },
          { label: "Sales today", value: "91" },
        ],
      },
    ],
  },
  pricing: {
    badge: "Pricing",
    title: "Simple, Transparent Pricing.",
    subtitle:
      "Every plan includes offline-first POS, barcode support, receipt printing, inventory, and cloud sync. Upgrade only as you grow.",
    trialNote: "14-day free trial",
    cards: {
      basic: {
        badge: "Starter",
        description:
          "Perfect for provision shops, boutiques, salons, and small retail businesses.",
        included: [
          "Offline POS",
          "Inventory",
          "Barcode",
          "Receipt Printing",
          "Reports",
          "Analytics",
        ],
        cta: "Start Free Trial",
        href: "/signup",
      },
      pro: {
        badge: "Most Popular",
        description:
          "Built for supermarkets, pharmacies, electronics stores, and growing wholesalers.",
        additional: [
          "Wholesale Inventory",
          "Branch Transfers",
          "Multi-Branch Management",
          "Advanced Analytics",
          "Priority Support",
        ],
        cta: "Start Free Trial",
        href: "/signup",
      },
      enterprise: {
        badge: "Custom",
        description:
          "Designed for distributors, retail chains, and organizations operating at enterprise scale.",
        cta: "Contact Sales",
        href: ENTERPRISE_SALES_MAILTO,
      },
      lifetime: {
        badge: "One-Time License",
        description:
          "Own Novend permanently with unlimited operational capacity and 1 year of updates included.",
        includes: [
          "Unlimited Products",
          "Unlimited Users",
          "Unlimited Branches",
          "Unlimited Devices",
          "1 GB Cloud Backup",
          "1 Year Updates",
        ],
        cta: "Buy Lifetime",
        href: "/signup",
      },
    },
    includedEveryPlan: [
      "Offline POS",
      "Barcode Scanner",
      "Receipt Printing",
      "Inventory",
      "Customers",
      "Suppliers",
      "Returns",
      "Analytics",
    ],
    trust: [
      { title: "No Setup Fees", detail: "Start without hidden costs" },
      { title: "Cancel Anytime", detail: "No long-term lock-in" },
      { title: "Secure & Reliable", detail: "Offline-first by design" },
      { title: "Free Updates", detail: "During your plan term" },
    ],
  },
  faq: {
    badge: "FAQ",
    title: "Frequently Asked Questions.",
    contactTitle: "Still have questions?",
    contactDetail:
      "We're here to help you. Contact our support team anytime.",
    contactCta: "Contact Support",
    contactHref: GENERAL_SALES_MAILTO,
    items: [
      {
        q: "Does Novend work offline?",
        a: "Yes. Every core business operation runs locally and automatically synchronizes when internet returns.",
      },
      {
        q: "Can I upgrade my plan later?",
        a: "Absolutely. Your products, customers, branches, and sales remain intact during upgrades.",
      },
      {
        q: "Can I import my existing inventory?",
        a: "Yes. Novend supports importing products and inventory through Excel and CSV.",
      },
      {
        q: "Does Novend support barcode scanners and receipt printers?",
        a: "Yes. Camera scanning, hardware barcode scanners, and thermal receipt printing are supported.",
      },
      {
        q: "Which businesses is Novend designed for?",
        a: "Supermarkets, pharmacies, wholesalers, boutiques, electronics stores, convenience shops, and other retail businesses.",
      },
    ],
  },
  cta: {
    title: "Ready to Transform Your Business?",
    subtitle:
      "Start your 14-day free trial and experience the complete offline-first commercial POS built for modern retail.",
    primary: "Start Free Trial",
    secondary: "Download App",
    secondaryHref: "/download",
    chips: ["No Card Required", "Setup in Minutes", "Works Offline"],
  },
  desktop: {
    id: "desktop",
    badge: "Apps & Downloads",
    title: "Run Novend on every counter — and soon every pocket",
    detail:
      "Install the desktop app for Windows, macOS, and Linux today. Use the web app anywhere. Mobile (iOS & Android via Capacitor) will publish on the same download page.",
    cta: "Go to downloads",
    href: "/download",
  },
  nav: {
    features: { href: "/#features", label: "Features" },
    industries: {
      label: "Industries",
      items: [
        { href: "/#industry-pharmacy", label: "Pharmacy" },
        { href: "/#industry-supermarket", label: "Supermarket" },
        { href: "/#industry-wholesale", label: "Wholesale" },
        { href: "/#industry-fashion", label: "Fashion" },
        { href: "/#industry-electronics", label: "Electronics" },
        { href: "/#industry-convenience", label: "Convenience" },
      ],
    },
    pricing: { href: "/#pricing", label: "Pricing" },
    resources: {
      label: "Resources",
      items: [
        { href: "/docs", label: "Docs" },
        { href: "/docs/help", label: "Help" },
        { href: "/docs/releases", label: "Releases" },
        { href: "/download", label: "Download" },
      ],
    },
    desktop: { href: "/download", label: "Download" },
  },
  navTrialCta: "Get Started",
  footer: {
    brandTitle: "Novend by Asiedu Development Hub",
    description:
      "Offline-first commercial POS built for supermarkets, pharmacies, wholesalers, boutiques, electronics stores, and modern retail businesses.",
    badges: ["Offline First", "Multi-Branch", "Desktop, Web & Mobile"],
    product: [
      { href: "/#features", label: "Features" },
      { href: "/#industries", label: "Industries" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/download", label: "Download" },
      { href: "/docs/releases", label: "Release Notes" },
    ],
    resources: [
      { href: "/docs", label: "Documentation" },
      { href: "/docs/help", label: "Help Center" },
      { href: GENERAL_SALES_MAILTO, label: "Contact Support" },
    ],
    legal: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
    contact: {
      title: "Get in Touch",
      email: {
        label: "Email",
        value: LANDING_CONTACT_EMAIL,
        href: `mailto:${LANDING_CONTACT_EMAIL}`,
      },
      international: {
        label: "WhatsApp & Calls",
        value: "+44 7868 178108",
        href: "https://wa.me/447868178108",
      },
      local: {
        label: "Local Support",
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
