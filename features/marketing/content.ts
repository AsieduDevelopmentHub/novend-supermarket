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
    primaryCta: "Get Started",
    secondaryCta: "Book a Demo",
  },
  journey: {
    eyebrow: "How Novend runs your day",
    title: "From warehouse receive to offline checkout — one operational path",
    subtitle:
      "Follow the same flow your team uses in the product: receive, restock branches, sell at the till, and sync when online.",
    steps: [
      {
        id: "receive",
        step: "01",
        title: "Receive stock",
        detail:
          "Supplier deliveries land in wholesale inventory with a recorded business reason — not silent quantity edits.",
        visual: "receive" as const,
      },
      {
        id: "restock",
        step: "02",
        title: "Restock branches",
        detail:
          "Issue cartons and crates from the warehouse to the counters that need them — Accra retail, Kumasi wholesale, or both.",
        visual: "restock" as const,
      },
      {
        id: "sell",
        step: "03",
        title: "Sell anywhere",
        detail:
          "Scan barcodes, discount, take MoMo or cash, and print a receipt — even when the connection drops mid-rush.",
        visual: "sell" as const,
      },
      {
        id: "sync",
        step: "04",
        title: "Stay in sync",
        detail:
          "Offline sales queue in the outbox. When internet returns, Convex becomes the committed source of truth automatically.",
        visual: "sync" as const,
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
        detail: "The device holds a local operational cache; you are not blocked waiting on the cloud to sell.",
      },
      {
        title: "Automatic synchronization",
        detail: "The outbox pushes committed work the moment connectivity returns.",
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
        detail: "Electron terminals for counters plus a PWA for flexible access — same Novend DNA.",
      },
    ],
    ghanaNote:
      "From neighborhood provision shops to pharmacy counters and wholesale distributors — Novend speaks Ghanaian retail without locking you into a single market.",
  },
  pricing: {
    title: "Pricing",
    subtitle: "Plan structure is ready. Billing activates in a future update.",
    badge: "Coming in a future update",
    plans: [
      {
        id: "basic",
        name: "Basic",
        status: "Coming Soon",
        blurb: "Single branch starter for focused counters.",
        featured: false,
        features: ["1 branch", "Core POS & receipts", "Offline checkout", "Email support"],
      },
      {
        id: "pro",
        name: "Pro",
        status: "Coming Soon",
        blurb: "Multi-branch operations for growing retailers.",
        featured: true,
        features: [
          "Multi-branch",
          "Wholesale warehouse flow",
          "Analytics & reports",
          "Priority support",
        ],
      },
      {
        id: "enterprise",
        name: "Enterprise",
        status: "Coming Soon",
        blurb: "Organization-wide control and guided rollout.",
        featured: false,
        features: [
          "Org-wide settings",
          "Advanced roles",
          "Dedicated onboarding",
          "SLA options",
        ],
      },
      {
        id: "lifetime",
        name: "Lifetime License",
        status: "Coming Soon",
        blurb: "One-time license path for long-term ownership.",
        featured: false,
        features: [
          "Perpetual license option",
          "Major version access window",
          "Desktop + PWA",
          "Community updates",
        ],
      },
    ],
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
        a: "Yes. Checkout and the operational cache run on the device. When you reconnect, committed work syncs through the outbox.",
      },
      {
        q: "Is there a desktop app?",
        a: "Yes. Electron builds for Windows, macOS, and Linux open straight to login — not the marketing site.",
      },
      {
        q: "Can I sign up myself?",
        a: "Organizations are provisioned by platform administrators. Use Get Started to sign in, or Contact Sales if you need an account.",
      },
      {
        q: "When will pricing be available?",
        a: "Billing is not live yet. Plan cards are placeholders so activation can ship without redesigning the page.",
      },
    ],
  },
  cta: {
    title: "Open the same product your team will run.",
    subtitle:
      "Offline-first checkout, inventory, and cloud sync — built for Ghanaian commerce, ready for growth.",
    primary: "Get Started",
    secondary: "Contact Sales",
  },
  nav: [
    { href: "#journey", label: "How it works" },
    { href: "#about", label: "Trust" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ],
  footer: {
    description:
      "Commercial offline-first Point of Sale for independent businesses — desktop, PWA, and cloud sync.",
    product: [
      { href: "#journey", label: "How it works" },
      { href: "#pricing", label: "Pricing" },
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
