/**
 * Public paths that should appear in sitemap.xml.
 * Millie's is a private till — only login is indexable.
 */
export const INDEXABLE_ROUTES = [
  { path: "/login", changeFrequency: "yearly" as const, priority: 0.5 },
] as const;

export type IndexableRoute = (typeof INDEXABLE_ROUTES)[number];

/** Path prefixes crawlers should not index. */
export const ROBOTS_DISALLOW = [
  "/",
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
  "/download",
  "/privacy",
  "/pricing",
  "/product",
  "/docs",
  "/contact",
  "/demo",
  "/terms",
  "/refund",
  "/cookies",
  "/aup",
  "/dpa",
  "/api/",
] as const;
