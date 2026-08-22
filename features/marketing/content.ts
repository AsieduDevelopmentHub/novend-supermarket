import { APP_BRAND, APP_TAGLINE } from "@/constants/app";

export const LANDING_CONTACT_EMAIL = "asiedudev.hub@gmail.com";

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
    { href: "#journey", label: "How it Works" },
    { href: "#architecture", label: "Offline" },
    { href: "#features", label: "Features" },
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
