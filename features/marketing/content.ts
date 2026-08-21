import { APP_BRAND, APP_TAGLINE } from "@/constants/app";

export const LANDING_CONTACT_EMAIL = "asiedudev.hub@gmail.com";

export const landingCopy = {
  brand: APP_BRAND,
  tagline: APP_TAGLINE,
  hero: {
    eyebrow: "Commercial offline-first POS",
    headline: "The Offline-First POS Built for Growing Businesses",
    subhead:
      "Sell faster, manage smarter, and keep your supermarket, pharmacy, or wholesale yard running—even without internet. Sync with confidence when the network returns.",
    primaryCta: "Start free trial",
    secondaryCta: "Book a Demo",
  },
  architecture: {
    eyebrow: "How your data moves",
    title: "Built to keep selling when the network does not",
    subtitle:
      "A clear path from the counter to your business view — without asking you to learn the stack.",
    flow: [
      { id: "device", label: "Device", detail: "The till where your team sells and receives stock." },
      {
        id: "local",
        label: "Local database",
        detail: "Sales and inventory stay on the terminal while you work offline.",
      },
      {
        id: "cloud",
        label: "Cloud sync",
        detail: "When you reconnect, committed work catches up automatically.",
      },
      {
        id: "dashboard",
        label: "Business dashboard",
        detail: "Branches, stock, and sales roll up into one clear picture.",
      },
    ],
  },
  journey: {
    eyebrow: "How Novend works",
    title: "One operational path — from supplier to synced sales",
    subtitle:
      "The same workflow your team runs in the product: receive, warehouse, transfer, sell, store locally, then sync.",
    steps: [
      {
        id: "receive",
        step: "01",
        title: "Receive stock from suppliers",
        detail:
          "Deliveries land with a recorded business reason — cartons and crates enter wholesale inventory cleanly.",
      },
      {
        id: "warehouse",
        step: "02",
        title: "Store in wholesale inventory",
        detail:
          "Warehouse stock stays honest and attributable — ready to issue when branches need refill.",
      },
      {
        id: "transfer",
        step: "03",
        title: "Transfer to branches",
        detail:
          "Move stock from the warehouse to East Legon retail, Kumasi wholesale, or any branch in your organization.",
      },
      {
        id: "sell",
        step: "04",
        title: "Sell through POS",
        detail:
          "Scan barcodes, adjust quantities, take MoMo or cash, and print a receipt — even mid-rush offline.",
      },
      {
        id: "local",
        step: "05",
        title: "Automatic local storage",
        detail:
          "Every completed sale and inventory change is stored on the device first so the till never waits on the network.",
      },
      {
        id: "sync",
        step: "06",
        title: "Cloud synchronization when online",
        detail:
          "Queued work syncs to the cloud, then your business dashboard reflects what actually moved.",
      },
    ],
  },
  industriesIntro: {
    title: "Built for Ghanaian commerce — ready to grow beyond it",
    subtitle:
      "Provision shops, pharmacies, electronics counters, fashion boutiques, and multi-branch retailers share one system.",
  },
  industries: [
    "Provision shops",
    "Pharmacies",
    "Supermarkets",
    "Wholesale distributors",
    "Electronics stores",
    "Fashion boutiques",
    "Hardware stores",
    "Mini-marts",
    "Beauty & cosmetics",
    "Agro & farm supply",
    "Phone accessory shops",
    "Bookshops & stationery",
  ],
  why: {
    eyebrow: "Security & trust",
    title: "Product controls that protect the till and the business",
    subtitle:
      "Trust comes from architecture you can operate — offline resilience, clear roles, and sync you can explain to your team.",
    cards: [
      {
        title: "Offline-first architecture",
        detail: "Checkout and operational stock stay available on the terminal when the network drops.",
      },
      {
        title: "Local data ownership",
        detail: "The device holds a local database; you are not blocked waiting on the cloud to sell.",
      },
      {
        title: "Automatic synchronization",
        detail: "Queued work pushes to the cloud the moment connectivity returns.",
      },
      {
        title: "Role-based security",
        detail: "Cashiers, managers, and admins inherit least privilege — never accidental admin powers.",
      },
      {
        title: "Multi-branch ready",
        detail: "Warehouse and branch stock stay aligned under one organization.",
      },
      {
        title: "Desktop & web",
        detail: "Dedicated desktop terminals plus a web app for flexible access — same Novend experience.",
      },
    ],
    ghanaNote:
      "From neighborhood provision shops to pharmacy counters and wholesale distributors — Novend speaks Ghanaian retail without locking you into a single market.",
  },
  pricing: {
    title: "Simple pricing that grows with you",
    subtitle:
      "Pay monthly or yearly, or own a lifetime licence that sits above every subscription. Every plan includes offline checkout, receipts and reports.",
    badge: "14-day free trial",
  },
  faq: {
    eyebrow: "Questions & answers",
    title: "A few important things to know about Novend.",
    items: [
      {
        q: "Who is Novend designed for?",
        a: "Retailers, pharmacies, wholesalers, electronics and fashion shops, and multi-branch operators who need a reliable till — especially where connectivity is uneven.",
      },
      {
        q: "Does Novend work offline?",
        a: "Yes. Checkout and the local database run on the device. When you reconnect, committed work syncs to the cloud automatically.",
      },
      {
        q: "Is there a desktop app?",
        a: "Yes. Desktop builds for Windows, macOS, and Linux open straight to login — not the marketing site.",
      },
      {
        q: "Can I sign up myself?",
        a: "Yes. Create an account, set up your business, and start a 14-day Pro trial. Staff logins are still created by your administrator.",
      },
      {
        q: "How does billing work?",
        a: "Pay monthly or yearly from Settings → Billing with Paystack (card or mobile money). Enterprise is the same checkout as Basic and Pro. Lifetime is a one-time licence priced above a year of every plan.",
      },
    ],
  },
  cta: {
    title: "Open the same product your team will run.",
    subtitle:
      "Offline-first checkout, inventory, and cloud sync — built for Ghanaian commerce, ready for growth.",
    primary: "Start free trial",
    secondary: "Contact Sales",
  },
  nav: [
    { href: "#journey", label: "How it works" },
    { href: "#architecture", label: "Architecture" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ],
  footer: {
    description:
      "Commercial offline-first Point of Sale for independent businesses — desktop, web, and cloud sync.",
    product: [
      { href: "#journey", label: "How it works" },
      { href: "#pricing", label: "Pricing" },
      { href: "/signup", label: "Start trial" },
      { href: "/login", label: "Login" },
    ],
    company: [
      { href: "#about", label: "About" },
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Contact" },
    ],
    builtBy: "Built by Asiedu Development Hub",
  },
} as const;
