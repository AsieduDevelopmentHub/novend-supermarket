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
    badge: "Commercial Offline-First POS",
    headline: "The POS That Keeps Your Business Selling — Even Offline.",
    subhead:
      "Sell, manage inventory, transfer stock between branches, and sync automatically when internet returns. Built for supermarkets, pharmacies, wholesalers, and modern retail businesses.",
    primaryCta: "Start 14-Day Free Trial",
    secondaryCta: "Watch Product Demo",
    trustBadges: ["Offline First", "Desktop + Web", "Multi-Branch", "Barcode Ready"],
    metrics: [
      { value: "Offline", label: "Always Ready" },
      { value: "Multi-Branch", label: "Up to Enterprise Scale" },
      { value: "Barcode", label: "Camera + Hardware" },
      { value: "Sync", label: "Automatic Cloud Backup" },
    ],
  },
  trustedBy: {
    title: "Trusted by businesses across Ghana",
    industries: ["Supermarkets", "Pharmacies", "Wholesale", "Electronics", "Fashion", "Cosmetics"],
  },
  architecture: {
    badge: "Offline-First Infrastructure",
    title: "Your Store Keeps Running. Even When the Internet Doesn't.",
    subtitle:
      "Novend saves every sale, inventory update, customer, and receipt directly on your device. When internet becomes available, everything synchronizes automatically without interrupting business.",
    flow: [
      {
        id: "device",
        title: "Store Device",
        label: "Work locally",
        detail: "Sales, products and inventory stay available at all times.",
      },
      {
        id: "local",
        title: "Local Business Data",
        label: "Saved instantly",
        detail: "Every sale and stock change is written on the device before anything else.",
      },
      {
        id: "sync",
        title: "Automatic Sync",
        label: "Syncs quietly",
        detail: "When you reconnect, pending work uploads in the background.",
      },
      {
        id: "dashboard",
        title: "Cloud Dashboard",
        label: "Access anywhere",
        detail: "Managers see branches, revenue, and stock from any connected device.",
      },
    ],
    guarantees: [
      {
        id: "selling",
        title: "Always Selling",
        detail: "Every checkout works without internet.",
      },
      {
        id: "ownership",
        title: "Local Data Ownership",
        detail: "Your operational data lives on your device first.",
      },
      {
        id: "backup",
        title: "Automatic Backup",
        detail: "Changes synchronize securely when online.",
      },
      {
        id: "branches",
        title: "Multi-Branch Ready",
        detail: "Every branch stays synchronized independently.",
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
  journey: {
    badge: "Business Workflow",
    title: "One Platform. Every Business Operation.",
    subtitle:
      "From receiving supplier stock to selling at the checkout, Novend keeps every operation synchronized locally and securely backed up to the cloud when you're online.",
    steps: [
      {
        id: "receive",
        railLabel: "Receive Stock",
        title: "Receive Inventory from Suppliers",
        detail:
          "Record supplier deliveries, update purchase costs, and organize products before they reach the sales floor.",
      },
      {
        id: "warehouse",
        railLabel: "Warehouse",
        title: "Organize Your Central Warehouse",
        detail:
          "Manage your wholesale inventory separately from branch stock while keeping accurate quantities and valuation.",
      },
      {
        id: "transfer",
        railLabel: "Branch Transfer",
        title: "Restock Branches in Seconds",
        detail:
          "Move inventory between branches with complete tracking, approval history, and real-time stock updates.",
      },
      {
        id: "sell",
        railLabel: "Checkout",
        title: "Fast Checkout with Barcode Support",
        detail:
          "Scan products, apply discounts, print receipts, and complete sales instantly—even without internet.",
      },
      {
        id: "local",
        railLabel: "Local Save",
        title: "Every Sale Is Saved Instantly",
        detail:
          "Novend writes every transaction directly to the local database, ensuring uninterrupted business during outages or poor connectivity.",
      },
      {
        id: "sync",
        railLabel: "Cloud Sync",
        title: "Automatically Sync When Online",
        detail:
          "As soon as internet becomes available, Novend securely synchronizes your changes to the cloud without interrupting your business.",
      },
    ],
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
    badge: "Built for Every Retail Business",
    title: "One Platform. Designed for Every Type of Store.",
    subtitle:
      "Whether you manage a neighborhood pharmacy, a supermarket, a wholesale warehouse, or a fashion boutique, Novend adapts to the way your business operates.",
    items: [
      {
        id: "pharmacy",
        pill: "Pharmacy",
        title: "Pharmacy & Medical Stores",
        detail:
          "Dispense with confidence using batch tracking, expiry alerts, and barcode-ready checkout built for regulated inventory.",
        capabilities: [
          "Batch & expiry tracking",
          "Barcode dispensing",
          "Supplier restocking",
          "Sales history",
        ],
        cta: "See Pharmacy Workflow",
        kpis: [
          { label: "Near expiry", value: "12" },
          { label: "SKUs tracked", value: "840" },
          { label: "Today’s scripts", value: "64" },
        ],
      },
      {
        id: "supermarket",
        pill: "Supermarket",
        title: "Supermarkets & Grocery",
        detail:
          "Keep high-volume counters moving with fast barcode checkout, category browsing, and receipts that print the moment payment clears.",
        capabilities: [
          "Fast barcode checkout",
          "Category browsing",
          "Hold & resume sales",
          "Instant receipts",
        ],
        cta: "See Supermarket Workflow",
        kpis: [
          { label: "Avg. checkout", value: "18s" },
          { label: "Categories", value: "36" },
          { label: "Open carts", value: "4" },
        ],
      },
      {
        id: "wholesale",
        pill: "Wholesale",
        title: "Wholesale & Distribution",
        detail:
          "Run a central warehouse, issue stock to branches, and keep supplier deliveries and bulk quantities accurate in one workflow.",
        capabilities: [
          "Wholesale storage",
          "Branch transfers",
          "Supplier deliveries",
          "Bulk quantities",
        ],
        cta: "See Wholesale Workflow",
        kpis: [
          { label: "Warehouse SKUs", value: "2.1k" },
          { label: "Open transfers", value: "7" },
          { label: "Branches", value: "5" },
        ],
      },
      {
        id: "fashion",
        pill: "Fashion",
        title: "Fashion & Apparel",
        detail:
          "Sell by size and color with product imagery, variation stock, and clean receipts tailored to boutique and apparel counters.",
        capabilities: [
          "Size & color variants",
          "Product imagery",
          "Stock by variation",
          "Boutique-ready receipts",
        ],
        cta: "See Fashion Workflow",
        kpis: [
          { label: "Variants", value: "318" },
          { label: "Low stock", value: "9" },
          { label: "Looks sold", value: "27" },
        ],
      },
      {
        id: "electronics",
        pill: "Electronics",
        title: "Electronics & High-Value Goods",
        detail:
          "Track serials and SKUs carefully, protect high-value inventory, and keep warranty-relevant product detail close to every sale.",
        capabilities: [
          "Serial / SKU control",
          "High-value inventory",
          "Product detail records",
          "Precise stock counts",
        ],
        cta: "See Electronics Workflow",
        kpis: [
          { label: "Active SKUs", value: "1.4k" },
          { label: "High value", value: "86" },
          { label: "Adjustments", value: "3" },
        ],
      },
      {
        id: "convenience",
        pill: "Convenience",
        title: "Convenience & Neighborhood Stores",
        detail:
          "Keep a lean catalog, scan quickly, and stay selling through outages with low-stock alerts that protect everyday essentials.",
        capabilities: [
          "Quick barcode checkout",
          "Lean product catalog",
          "Low-stock alerts",
          "Offline-ready till",
        ],
        cta: "See Convenience Workflow",
        kpis: [
          { label: "Catalog size", value: "220" },
          { label: "Low stock", value: "14" },
          { label: "Sales today", value: "91" },
        ],
      },
    ],
    metrics: [
      { label: "Industries Supported", value: "20+" },
      { label: "Offline Availability", value: "100%" },
      { label: "Deployment Options", value: "Desktop · Web · Mobile Ready" },
    ],
  },
  analytics: {
    eyebrow: "Analytics",
    title: "See your business clearly",
    subtitle:
      "The same dashboard your team uses every day — KPIs, trends, categories, and recent sales in one view.",
  },
  pricing: {
    badge: "Simple Commercial Pricing",
    title: "Start Small. Scale Without Changing Software.",
    subtitle:
      "Every Novend plan includes the complete offline-first POS, barcode support, receipt printing, inventory management, and cloud synchronization. Upgrade only as your business grows.",
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
        cta: "Start Pro Trial",
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
          "Own Novend permanently with unlimited operational capacity and 1.5 years of updates included.",
        includes: [
          "Unlimited Products",
          "Unlimited Users",
          "Unlimited Branches",
          "Unlimited Devices",
          "1 GB Cloud Backup",
          "1.5 Years Updates",
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
      {
        title: "14-Day Free Trial",
        detail: "No card required",
      },
      {
        title: "Offline-First Always",
        detail: "Keep selling without internet",
      },
      {
        title: "Upgrade Anytime",
        detail: "Your data stays intact",
      },
    ],
  },
  trust: {
    badge: "Trusted Business Infrastructure",
    title: "Everything You Need to Start with Confidence",
    subtitle:
      "Novend is built for real business operations with offline-first reliability, automatic cloud synchronization, secure data ownership, and seamless upgrades as your business grows.",
    cards: [
      {
        id: "offline",
        title: "Offline-First Always",
        detail:
          "Every sale, inventory update, customer, and receipt continues working without internet.",
      },
      {
        id: "data",
        title: "Your Data Belongs to You",
        detail:
          "Business data is stored locally first and securely synchronized to the cloud when connected.",
      },
      {
        id: "upgrade",
        title: "Upgrade Without Losing Data",
        detail:
          "Move from Basic to Pro or Enterprise without migrating or rebuilding your system.",
      },
      {
        id: "support",
        title: "Commercial Support",
        detail:
          "Get onboarding assistance, updates, and priority support for growing businesses.",
      },
    ],
  },
  faq: {
    badge: "FAQ",
    title: "Questions business owners ask before they start",
    items: [
      {
        q: "Does Novend work without internet?",
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
        a: "Yes. Camera scanning, hardware barcode scanners, and thermal receipt printing are supported across the platform.",
      },
      {
        q: "Which businesses is Novend designed for?",
        a: "Supermarkets, pharmacies, wholesalers, boutiques, electronics stores, convenience shops, and many other retail businesses.",
      },
    ],
  },
  cta: {
    title: "Ready to Modernize Your Business?",
    subtitle:
      "Start your 14-day free trial and experience the complete offline-first commercial POS built for modern retail.",
    primary: "Start Free Trial",
    secondary: "Contact Sales",
    chips: ["No Card Required", "Setup in Minutes", "Works Offline"],
  },
  nav: [
    { href: "#journey", label: "How it Works" },
    { href: "#architecture", label: "Offline" },
    { href: "#features", label: "Features" },
    { href: "#industries", label: "Industries" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ],
  navTrialCta: "Start Free Trial",
  footer: {
    description:
      "Commercial offline-first Point of Sale for independent businesses — desktop, web, and cloud sync.",
    product: [
      { href: "#features", label: "Features" },
      { href: "#pricing", label: "Pricing" },
      { href: "#journey", label: "Desktop" },
      { href: "#faq", label: "Updates" },
    ],
    resources: [
      { href: "#architecture", label: "Documentation" },
      { href: "#faq", label: "Help Center" },
      { href: "#contact", label: "Contact" },
    ],
    company: [
      { href: "#about", label: "About" },
      { href: "#privacy", label: "Privacy" },
      { href: "#terms", label: "Terms" },
    ],
    socials: [{ href: `mailto:${LANDING_CONTACT_EMAIL}`, label: "Email" }],
    builtBy: "Built by Asiedu Development Hub",
  },
} as const;
