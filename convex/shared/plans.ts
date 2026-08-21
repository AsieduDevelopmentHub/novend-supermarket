/**
 * Canonical commercial plan catalog.
 *
 * This module is the single source of truth for entitlements. It is pure data +
 * pure functions so it can be imported by Convex, the Next.js app, and tests
 * without pulling in a database. The `plans` table mirrors this catalog and adds
 * payment-gateway plan codes; it never overrides these limits.
 *
 * `null` limit means unlimited.
 */

export const PLAN_KEYS = ["basic", "pro", "enterprise", "lifetime"] as const;

export type PlanKey = (typeof PLAN_KEYS)[number];

export type PlanLimits = {
  products: number | null;
  users: number | null;
  branches: number | null;
  devices: number | null;
  backupBytes: number | null;
};

export type LimitResource = keyof PlanLimits;

export type BillingCycle = "monthly" | "yearly" | "lifetime";

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  tagline: string;
  audience: string;
  /** GH₵ per month. `null` when the plan is not sold monthly. */
  monthlyPrice: number | null;
  /** GH₵ per year. `null` when the plan is not sold yearly. */
  yearlyPrice: number | null;
  /** GH₵ one-time. `null` unless the plan is a perpetual licence. */
  oneTimePrice: number | null;
  /** Enterprise is quoted, so the published price is a starting point. */
  priceFrom: boolean;
  isLifetime: boolean;
  featured: boolean;
  /** Self-service checkout is available for this plan. */
  selfServe: boolean;
  sortOrder: number;
  limits: PlanLimits;
  features: string[];
};

const GIGABYTE = 1024 * 1024 * 1024;

export const GB_IN_BYTES = GIGABYTE;

export const PLAN_CATALOG: Record<PlanKey, PlanDefinition> = {
  basic: {
    key: "basic",
    name: "Basic",
    tagline: "Everything a single shop needs to sell and track stock.",
    audience: "Small retail businesses",
    monthlyPrice: 149,
    yearlyPrice: 1490,
    oneTimePrice: null,
    priceFrom: false,
    isLifetime: false,
    featured: false,
    selfServe: true,
    sortOrder: 1,
    limits: {
      products: 500,
      users: 3,
      branches: 1,
      devices: 2,
      backupBytes: 2 * GIGABYTE,
    },
    features: [
      "Offline POS",
      "Inventory",
      "Customers",
      "Suppliers",
      "Returns",
      "Expenses",
      "Reports",
      "Analytics",
      "Receipt printing",
      "Barcode scanner",
    ],
  },
  pro: {
    key: "pro",
    name: "Pro",
    tagline: "Wholesale, branches and analytics for growing businesses.",
    audience: "Supermarkets, pharmacies and wholesalers",
    monthlyPrice: 299,
    yearlyPrice: 2990,
    oneTimePrice: null,
    priceFrom: false,
    isLifetime: false,
    featured: true,
    selfServe: true,
    sortOrder: 2,
    limits: {
      products: 5000,
      users: 15,
      branches: 5,
      devices: 5,
      backupBytes: 10 * GIGABYTE,
    },
    features: [
      "Everything in Basic",
      "Wholesale inventory",
      "Branch transfers",
      "Advanced analytics",
      "Cloud synchronization",
      "Priority support",
    ],
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    tagline: "Unlimited scale with dedicated onboarding and support.",
    audience: "Multi-branch groups and distributors",
    monthlyPrice: 599,
    yearlyPrice: 5990,
    oneTimePrice: null,
    priceFrom: true,
    isLifetime: false,
    featured: false,
    selfServe: false,
    sortOrder: 3,
    limits: {
      products: null,
      users: null,
      branches: null,
      devices: null,
      backupBytes: 50 * GIGABYTE,
    },
    features: [
      "Everything in Pro",
      "Dedicated support",
      "Custom deployment",
      "API ready",
      "Enterprise onboarding",
    ],
  },
  lifetime: {
    key: "lifetime",
    name: "Lifetime",
    tagline: "One payment, permanent desktop licence.",
    audience: "Businesses that prefer to own their software",
    monthlyPrice: null,
    yearlyPrice: null,
    oneTimePrice: 4999,
    priceFrom: false,
    isLifetime: true,
    featured: false,
    selfServe: true,
    sortOrder: 4,
    limits: {
      products: null,
      users: null,
      branches: null,
      devices: 5,
      backupBytes: 10 * GIGABYTE,
    },
    features: [
      "Permanent desktop licence",
      "Offline operations",
      "Cloud sync",
      "Analytics",
      "Reports",
      "One year of updates",
    ],
  },
};

export const DEFAULT_PLAN_KEY: PlanKey = "lifetime";

export const PLAN_LIST: PlanDefinition[] = PLAN_KEYS.map((key) => PLAN_CATALOG[key]).sort(
  (a, b) => a.sortOrder - b.sortOrder,
);

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && (PLAN_KEYS as readonly string[]).includes(value);
}

/**
 * Resolves a stored plan value to a definition. Unknown or legacy values
 * (for example the pre-billing `"standard"` string) fall back to the default so
 * an organization is never left without entitlements.
 */
export function resolvePlan(value: unknown): PlanDefinition {
  return isPlanKey(value) ? PLAN_CATALOG[value] : PLAN_CATALOG[DEFAULT_PLAN_KEY];
}

export function planLimit(planKey: PlanKey, resource: LimitResource): number | null {
  return PLAN_CATALOG[planKey].limits[resource];
}

/** Price for a cycle, or `null` when the plan is not sold on that cycle. */
export function priceForCycle(plan: PlanDefinition, cycle: BillingCycle): number | null {
  if (cycle === "monthly") return plan.monthlyPrice;
  if (cycle === "yearly") return plan.yearlyPrice;
  return plan.oneTimePrice;
}

export function supportsCycle(plan: PlanDefinition, cycle: BillingCycle): boolean {
  if (plan.isLifetime) return cycle === "lifetime";
  return cycle !== "lifetime" && priceForCycle(plan, cycle) !== null;
}

export const RESOURCE_LABELS: Record<LimitResource, string> = {
  products: "Products",
  users: "Users",
  branches: "Branches",
  devices: "Devices",
  backupBytes: "Cloud backup",
};

/** Message shown when a create action is blocked by the plan. */
export function limitReachedMessage(
  planKey: PlanKey,
  resource: LimitResource,
  limit: number,
): string {
  const plan = PLAN_CATALOG[planKey];
  switch (resource) {
    case "products":
      return `Your ${plan.name} plan includes ${limit.toLocaleString()} products. Upgrade to add more.`;
    case "users":
      return `Your ${plan.name} plan includes ${limit} staff accounts. Upgrade to add more.`;
    case "branches":
      return `Your ${plan.name} plan supports ${limit} ${limit === 1 ? "branch" : "branches"}. Upgrade to add more locations.`;
    case "devices":
      return `Device limit reached. Deactivate another device or upgrade your plan.`;
    case "backupBytes":
      return `Cloud backup storage is full on the ${plan.name} plan. Upgrade for more space.`;
  }
}
