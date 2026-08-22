import { APP_BRAND, APP_TAGLINE } from "@/constants/app";

export const LANDING_CONTACT_EMAIL = "asiedudev.hub@gmail.com";

export const landingCopy = {
  brand: APP_BRAND,
  tagline: APP_TAGLINE,
  hero: {
    eyebrow: "Offline-first POS",
    headline: "The Offline-First POS Built for Modern Retail.",
    subhead:
      "Sell, manage inventory, track branches, and run your business—even without internet.",
    primaryCta: "Start Free Trial",
    secondaryCta: "Watch Demo",
    trustBadges: ["Offline First", "Multi-Branch", "Works on Desktop, Mobile & Web"],
  },
  trustedBy: {
    title: "Trusted by businesses across Ghana",
    industries: ["Supermarkets", "Pharmacies", "Wholesale", "Electronics", "Fashion", "Cosmetics"],
  },
  architecture: {
    eyebrow: "Offline architecture",
    title: "Your Business Never Waits for Internet",
    subtitle:
      "Instant checkout, local analytics, automatic sync, and background backup — without learning the stack.",
    flow: [
      { id: "device", label: "Device", detail: "The till where your team sells and receives stock." },
      {
        id: "local",
        label: "Local database",
        detail: "Sales and inventory stay on the terminal while you work offline.",
      },
      {
        id: "sync",
        label: "Sync engine",
        detail: "When you reconnect, committed work catches up automatically.",
      },
      {
        id: "dashboard",
        label: "Cloud dashboard",
        detail: "Branches, stock, and sales roll up into one clear picture.",
      },
    ],
    benefits: [
      "Instant checkout",
      "Local analytics",
      "Automatic sync",
      "Background backup",
    ],
  },
  journey: {
    eyebrow: "How Novend works",
    title: "From supplier to synced sales",
    subtitle:
      "One operational path your team already understands — receive, warehouse, transfer, sell, store locally, then sync.",
    steps: [
      {
        id: "receive",
        step: "01",
        title: "Receive Stock",
        detail:
          "Deliveries land with a recorded business reason — cartons and crates enter wholesale inventory cleanly.",
      },
      {
        id: "warehouse",
        step: "02",
        title: "Wholesale Inventory",
        detail:
          "Warehouse stock stays honest and attributable — ready to issue when branches need refill.",
      },
      {
        id: "transfer",
        step: "03",
        title: "Transfer to Branches",
        detail:
          "Move stock from the warehouse to any branch in your organization with full traceability.",
      },
      {
        id: "sell",
        step: "04",
        title: "Sell with POS",
        detail:
          "Scan barcodes, adjust quantities, take MoMo or cash, and print a receipt — even mid-rush offline.",
      },
      {
        id: "local",
        step: "05",
        title: "Save Locally",
        detail:
          "Every completed sale and inventory change is stored on the device first so the till never waits on the network.",
      },
      {
        id: "sync",
        step: "06",
        title: "Sync to Cloud",
        detail:
          "Queued work syncs to the cloud, then your business dashboard reflects what actually moved.",
      },
    ],
  },
  features: {
    eyebrow: "Features",
    title: "Everything a modern store needs",
    subtitle: "Six core capabilities — built for real counters, not slide decks.",
    cards: [
      {
        title: "Offline POS",
        detail: "Checkout, receipts, and held sales keep running when the network drops.",
      },
      {
        title: "Inventory",
        detail: "Branch stock, low-stock alerts, expiry tracking, and full audit history.",
      },
      {
        title: "Barcode Scanner",
        detail: "USB scanners and camera capture — products found in milliseconds.",
      },
      {
        title: "Branch Management",
        detail: "Warehouse to branch transfers with organization-wide visibility.",
      },
      {
        title: "Reports",
        detail: "Daily sales, branch performance, and exportable business summaries.",
      },
      {
        title: "Analytics",
        detail: "KPI cards, revenue trends, and category breakdowns managers trust.",
      },
    ],
  },
  industriesIntro: {
    title: "Built for how you actually sell",
    subtitle: "From provision shops to pharmacies and wholesale yards — one system, many formats.",
  },
  industries: [
    { name: "Pharmacy", hint: "Expiry tracking & fast checkout" },
    { name: "Supermarket", hint: "High-volume barcode sales" },
    { name: "Wholesale", hint: "Warehouse & branch transfers" },
    { name: "Boutique", hint: "Variants & clean receipts" },
    { name: "Electronics", hint: "SKU-heavy catalog" },
    { name: "Convenience Store", hint: "Quick sales offline" },
  ],
  analytics: {
    eyebrow: "Analytics",
    title: "See your business clearly",
    subtitle:
      "The same dashboard your team uses every day — KPIs, trends, categories, and recent sales in one view.",
  },
  pricing: {
    title: "Simple pricing that grows with you",
    subtitle:
      "Pay monthly or yearly, or own a lifetime licence. Every plan includes offline checkout, receipts, and reports.",
    badge: "14-day free trial",
  },
  faq: {
    eyebrow: "FAQ",
    title: "Questions & answers",
    items: [
      {
        q: "Does Novend work offline?",
        a: "Yes. Checkout and your local database run on the device. When you reconnect, committed work syncs to the cloud automatically.",
      },
      {
        q: "Can I use multiple branches?",
        a: "Yes. Move warehouse stock to branches, filter reports by location, and manage staff per branch.",
      },
      {
        q: "Can I migrate my inventory?",
        a: "Yes. Import products, set opening stock, and start selling. Your team can receive and adjust stock with full history.",
      },
      {
        q: "Do I need internet?",
        a: "Only for initial setup and sync. Day-to-day selling works offline; the network catches up when it returns.",
      },
      {
        q: "Is there a desktop app, or mobile app?",
        a: "Yes. Dedicated desktop builds for Windows, macOS, and Linux plus a web app for phones and tablets — same Novend experience.",
      },
    ],
  },
  cta: {
    title: "Ready to Modernize Your Store?",
    subtitle:
      "Offline-first checkout, inventory, and cloud sync — built for real businesses, ready to grow.",
    primary: "Start Free Trial",
    secondary: "Contact Sales",
  },
  nav: [
    { href: "#features", label: "Features" },
    { href: "#industries", label: "Industries" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ],
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
