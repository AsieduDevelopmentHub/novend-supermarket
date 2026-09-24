/**
 * Public paths that should appear in sitemap.xml and remain crawlable.
 * Keep in sync with robots allow-list intent (authenticated shell is disallowed separately).
 */
export const INDEXABLE_ROUTES = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/product", changeFrequency: "weekly", priority: 0.85 },
  { path: "/product/pos", changeFrequency: "monthly", priority: 0.8 },
  { path: "/product/inventory", changeFrequency: "monthly", priority: 0.8 },
  { path: "/product/branches", changeFrequency: "monthly", priority: 0.8 },
  { path: "/product/reports", changeFrequency: "monthly", priority: 0.8 },
  { path: "/product/offline-sync", changeFrequency: "monthly", priority: 0.8 },
  { path: "/download", changeFrequency: "weekly", priority: 0.9 },
  { path: "/docs", changeFrequency: "monthly", priority: 0.8 },
  { path: "/docs/help", changeFrequency: "monthly", priority: 0.8 },
  { path: "/docs/releases", changeFrequency: "weekly", priority: 0.7 },
  { path: "/login", changeFrequency: "yearly", priority: 0.5 },
  { path: "/signup", changeFrequency: "yearly", priority: 0.6 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/refund", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cookies", changeFrequency: "yearly", priority: 0.3 },
  { path: "/aup", changeFrequency: "yearly", priority: 0.3 },
  { path: "/dpa", changeFrequency: "yearly", priority: 0.3 },
] as const;

export type IndexableRoute = (typeof INDEXABLE_ROUTES)[number];

/** Path prefixes crawlers should not index (POS shell, APIs, callbacks). */
export const ROBOTS_DISALLOW = [
  "/dashboard",
  "/sales",
  "/orders",
  "/returns",
  "/inventory",
  "/wholesale",
  "/customers",
  "/products",
  "/reports",
  "/analytics",
  "/settings",
  "/more",
  "/about",
  "/users",
  "/branches",
  "/suppliers",
  "/platform",
  "/customer-display",
  "/onboarding",
  "/forgot-password",
  "/reset-password",
  "/billing",
  "/api/",
] as const;
