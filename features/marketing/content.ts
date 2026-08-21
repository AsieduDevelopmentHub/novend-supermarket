import { APP_BRAND, APP_TAGLINE } from "@/constants/app";

export const LANDING_CONTACT_EMAIL = "asiedudev.hub@gmail.com";

export const landingCopy = {
  brand: APP_BRAND,
  tagline: APP_TAGLINE,
  hero: {
    eyebrow: "Offline-first POS for everyday commerce",
    headlineLead: "Sell faster.",
    headlineAccent: "Stay in control — online or off.",
    subhead:
      "Novend turns sales, stock, and branch operations into one clear system — so Ghanaian shops, pharmacies, wholesalers, and multi-branch retailers keep moving when the network drops, then sync with confidence.",
    primaryCta: "Get Started",
    secondaryCta: "Book a Demo",
  },
  howItWorks: {
    eyebrow: "How it works",
    title: "From counter to cloud — without slowing the till",
    subtitle:
      "Local-first checkout on the terminal. Automatic catch-up when connectivity returns.",
    steps: [
      { step: "01", title: "Sell on the terminal", detail: "Scan, discount, and take payment — even offline." },
      { step: "02", title: "Stock stays honest", detail: "Every sale and receive writes a reasoned inventory change." },
      { step: "03", title: "Branches stay aligned", detail: "Warehouse issues to branches under one organization." },
      { step: "04", title: "Sync when online", detail: "The outbox pushes committed work to Convex automatically." },
      { step: "05", title: "See what moved", detail: "Analytics and reports reflect real sales — not guesswork." },
    ],
  },
  audience: {
    title: "Built around your counter. Connected to your business.",
    subtitle: "One product for the people who ring the till and the people who run the shop.",
    forCashiers: {
      title: "For cashiers",
      detail:
        "Fast checkout, barcode scanning, and sticky totals — without waiting on a shaky connection.",
    },
    forManagers: {
      title: "For managers",
      detail: "Branch stock, held sales, and day-to-day control in one workspace.",
    },
    highlights: [
      "Offline-first operational cache on the device",
      "Cloud authority when you reconnect",
      "Electron desktop + installable PWA",
      "Roles and organization isolation by design",
    ],
  },
  industriesIntro: {
    title: "Trusted across modern commerce",
    subtitle: "Familiar businesses across Ghana — ready to grow beyond it.",
  },
  industries: [
    "Retail",
    "Pharmacy",
    "Supermarket",
    "Wholesale",
    "Electronics",
    "Fashion",
    "Hardware",
  ],
  features: {
    eyebrow: "Platform",
    title: "What you get on day one",
    subtitle: "Fewer screens. Clearer workflows. The capabilities that matter at the till.",
    items: [
      {
        title: "Offline-first POS",
        detail: "Keep selling when internet is unreliable — sync later without redoing the day.",
      },
      {
        title: "Inventory that never goes silent",
        detail: "Receives, adjustments, and sales always leave a business reason.",
      },
      {
        title: "Wholesale → branch flow",
        detail: "Buy into warehouse stock, then issue to the counters that need it.",
      },
      {
        title: "Desktop & mobile ready",
        detail: "Native Electron terminals plus a PWA for flexible counters.",
      },
    ],
  },
  why: {
    eyebrow: "Security & trust",
    title: "Designed for control. Built for real shops.",
    subtitle:
      "Secure access and accountable operations — without slowing checkout. Calm enterprise controls in a layout built for confidence.",
    cards: [
      {
        title: "Offline resilience",
        detail: "Sales and stock stay available on the terminal when the network drops.",
      },
      {
        title: "Automatic sync",
        detail: "The outbox catches up committed work the moment you reconnect.",
      },
      {
        title: "Local + cloud truth",
        detail: "Operational cache on device; Convex remains the committed source of truth.",
      },
      {
        title: "Least privilege",
        detail: "Role-based access so cashiers never inherit admin capabilities.",
      },
      {
        title: "Attributable actions",
        detail: "Important operations stay tied to user, time, and reason.",
      },
      {
        title: "Org isolation",
        detail: "Every business record stays scoped to the session organization.",
      },
    ],
    ghanaNote:
      "From Accra pharmacies to Kumasi wholesale yards and neighborhood provision shops — Novend speaks Ghanaian retail without locking you into a single market.",
  },
  pricing: {
    title: "Pricing",
    subtitle: "Production-ready plan structure. Billing activates in a future update.",
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
        a: "Independent retailers, pharmacies, wholesalers, and multi-branch operators who need a reliable till — especially where connectivity is uneven.",
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
    title: "See Novend in action.",
    subtitle:
      "Explore offline-first checkout, inventory, and cloud sync — built for Ghana, ready for growth.",
    primary: "Get Started",
    secondary: "Contact Sales",
  },
  nav: [
    { href: "#how-it-works", label: "How it works" },
    { href: "#platform", label: "Platform" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ],
  footer: {
    description:
      "Commercial offline-first Point of Sale for independent businesses — desktop, PWA, and cloud sync.",
    product: [
      { href: "#how-it-works", label: "How it works" },
      { href: "#platform", label: "Platform" },
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
