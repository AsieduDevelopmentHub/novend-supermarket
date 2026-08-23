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
  /** When true, the published price is a starting point rather than a fixed amount. */
  priceFrom: boolean;
  /**
   * When true, cloud backup is quoted per organization instead of a catalog
   * number. `limits.backupBytes` stays `null`; Super Admin assigns the quota.
   */
  variableBackup: boolean;
  isLifetime: boolean;
  featured: boolean;
  /** Self-service checkout is available for this plan. */
  selfServe: boolean;
  sortOrder: number;
  limits: PlanLimits;
  features: string[];
};

export const KIBIBYTE = 1024;
export const MEBIBYTE = 1024 * 1024;
export const GIBIBYTE = 1024 * 1024 * 1024;
/** @deprecated Use `GIBIBYTE`. */
export const GB_IN_BYTES = GIBIBYTE;

/** Updates and premium support included with a lifetime licence. */
export const LIFETIME_UPDATES_YEARS = 1;

/** Yearly price bills 10 months (two months free). Used by every recurring plan. */
export const YEARLY_MONTHS_BILLED = 10;

export function yearlyPriceFromMonthly(monthly: number): number {
  return monthly * YEARLY_MONTHS_BILLED;
}

/** Catalog display: starting prices use a + so they are not read as a fixed rate. */
export function formatPlanPriceLabel(amount: number, priceFrom = false): string {
  const formatted = `GH₵${amount.toLocaleString("en-GH")}`;
  return priceFrom ? `${formatted}+` : formatted;
}

export function formatPlanBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes >= GIBIBYTE && bytes % GIBIBYTE === 0) return `${bytes / GIBIBYTE} GB`;
  if (bytes >= MEBIBYTE && bytes % MEBIBYTE === 0) return `${bytes / MEBIBYTE} MB`;
  if (bytes >= MEBIBYTE) return `${Math.round(bytes / MEBIBYTE)} MB`;
  return `${bytes} B`;
}

export const PLAN_CATALOG: Record<PlanKey, PlanDefinition> = {
  basic: {
    key: "basic",
    name: "Basic",
    tagline: "Everything a single shop needs to sell and track stock.",
    audience: "Small retail businesses",
    monthlyPrice: 200,
    yearlyPrice: yearlyPriceFromMonthly(200),
    oneTimePrice: null,
    priceFrom: false,
    variableBackup: false,
    isLifetime: false,
    featured: false,
    selfServe: true,
    sortOrder: 1,
    limits: {
      products: 500,
      users: 3,
      branches: 1,
      devices: 3,
      backupBytes: 250 * MEBIBYTE,
    },
    features: [
      "Offline POS",
      "Inventory",
      "Products & categories",
      "Customers & suppliers",
      "Barcode (camera & hardware)",
      "Receipt printing",
      "Returns",
      "Expenses",
      "Reports",
      "Analytics",
    ],
  },
  pro: {
    key: "pro",
    name: "Pro",
    tagline: "Wholesale, branches and analytics for growing businesses.",
    audience: "Supermarkets, pharmacies and wholesalers",
    monthlyPrice: 450,
    yearlyPrice: yearlyPriceFromMonthly(450),
    oneTimePrice: null,
    priceFrom: false,
    variableBackup: false,
    isLifetime: false,
    featured: true,
    selfServe: true,
    sortOrder: 2,
    limits: {
      products: 5000,
      users: 15,
      branches: 5,
      devices: 15,
      backupBytes: 500 * MEBIBYTE,
    },
    features: [
      "Everything in Basic",
      "Wholesale inventory",
      "Branch transfers",
      "Multi-branch management",
      "Advanced analytics",
      "Priority support",
    ],
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    tagline: "Unlimited scale with dedicated onboarding and support.",
    audience: "Multi-branch groups and distributors",
    monthlyPrice: 750,
    yearlyPrice: yearlyPriceFromMonthly(750),
    oneTimePrice: null,
    priceFrom: true,
    variableBackup: true,
    isLifetime: false,
    featured: false,
    selfServe: true,
    sortOrder: 3,
    limits: {
      products: null,
      users: null,
      branches: null,
      devices: null,
      backupBytes: null,
    },
    features: [
      "Everything in Pro",
      "Custom cloud backup",
      "API ready",
      "Custom integrations",
      "Dedicated support",
      "Enterprise onboarding",
    ],
  },
  lifetime: {
    key: "lifetime",
    name: "Lifetime",
    tagline: "Own Novend outright — every plan, permanently.",
    audience: "Businesses that prefer to own their software",
    monthlyPrice: null,
    yearlyPrice: null,
    oneTimePrice: 7990,
    priceFrom: false,
    variableBackup: false,
    isLifetime: true,
    featured: false,
    selfServe: true,
    sortOrder: 4,
    limits: {
      products: null,
      users: null,
      branches: null,
      devices: null,
      backupBytes: 1 * GIBIBYTE,
    },
    features: [
      "Everything in Enterprise",
      "Permanent commercial licence",
      `${LIFETIME_UPDATES_YEARS} year of updates and premium support`,
      "Offline operations",
      "Cloud sync",
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

export const MIN_CUSTOM_BACKUP_GB = 1;
export const MAX_CUSTOM_BACKUP_GB = 1024;

export type LimitOverrides = {
  products?: number | null;
  users?: number | null;
  branches?: number | null;
  devices?: number | null;
};

/**
 * Catalog limits with the per-organization Enterprise backup quota (when set)
 * and any explicit Super Admin overrides applied. Overrides always win — they
 * are a deliberate platform-admin action, audited at the call site — while an
 * absent key keeps inheriting the plan's catalog limit.
 */
export function effectivePlanLimits(
  plan: PlanDefinition,
  organizationBackupLimitBytes?: number | null,
  overrides?: LimitOverrides | null,
): PlanLimits {
  const base: PlanLimits = plan.variableBackup
    ? { ...plan.limits, backupBytes: organizationBackupLimitBytes ?? null }
    : plan.limits;
  if (!overrides) return base;
  return {
    products: overrides.products !== undefined ? overrides.products : base.products,
    users: overrides.users !== undefined ? overrides.users : base.users,
    branches: overrides.branches !== undefined ? overrides.branches : base.branches,
    devices: overrides.devices !== undefined ? overrides.devices : base.devices,
    backupBytes: base.backupBytes,
  };
}

/** Converts a Super Admin gigabyte entry to stored bytes. `null` means no cap. */
export function parseCustomBackupGb(gigabytes: number | null): number | null {
  if (gigabytes === null) return null;
  if (
    !Number.isInteger(gigabytes) ||
    gigabytes < MIN_CUSTOM_BACKUP_GB ||
    gigabytes > MAX_CUSTOM_BACKUP_GB
  ) {
    throw new Error(
      `Cloud backup must be a whole number of GB from ${MIN_CUSTOM_BACKUP_GB} to ${MAX_CUSTOM_BACKUP_GB}, or empty for no cap.`,
    );
  }
  return gigabytes * GIBIBYTE;
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

export function formatPlanLimit(resource: LimitResource, limit: number | null): string {
  if (limit === null) {
    switch (resource) {
      case "products":
        return "Unlimited products";
      case "users":
        return "Unlimited users";
      case "branches":
        return "Unlimited branches";
      case "devices":
        return "Unlimited devices";
      case "backupBytes":
        return "Unlimited cloud backup";
    }
  }
  switch (resource) {
    case "products":
      return `${limit.toLocaleString()} products`;
    case "users":
      return `${limit.toLocaleString()} users`;
    case "branches":
      return `${limit.toLocaleString()} ${limit === 1 ? "branch" : "branches"}`;
    case "devices":
      return `${limit.toLocaleString()} devices`;
    case "backupBytes":
      return `${formatPlanBytes(limit)} cloud backup`;
  }
}

/** Compact limit lines for pricing cards, in display order. */
export function planLimitLines(plan: PlanDefinition): string[] {
  return (Object.keys(plan.limits) as LimitResource[]).map((resource) => {
    if (resource === "backupBytes" && plan.variableBackup) {
      return "Custom cloud backup";
    }
    return formatPlanLimit(resource, plan.limits[resource]);
  });
}

/** Message shown when a create action is blocked by the plan. */
export function limitReachedMessage(
  planKey: PlanKey,
  resource: LimitResource,
  limit: number,
): string {
  const plan = PLAN_CATALOG[planKey];
  switch (resource) {
    case "products":
      return `Cannot create Product #${limit + 1} on ${plan.name}. Upgrade to add more.`;
    case "users":
      return `Cannot create User #${limit + 1} on ${plan.name}. Upgrade to add more.`;
    case "branches":
      return `Cannot create Branch #${limit + 1} on ${plan.name}. Upgrade to add more.`;
    case "devices":
      return `Cannot activate Device #${limit + 1} on ${plan.name}. Deactivate another device or upgrade.`;
    case "backupBytes":
      return `Cloud backup pauses after ${formatPlanBytes(limit)} on ${plan.name}. Local backups continue.`;
  }
}

export type PlanChangeKind = "upgrade" | "downgrade" | "same";

/** Compare catalog rank. Lifetime is above paid tiers; same key is `same`. */
export function planChangeKind(from: PlanKey, to: PlanKey): PlanChangeKind {
  if (from === to) return "same";
  const fromOrder = PLAN_CATALOG[from].sortOrder;
  const toOrder = PLAN_CATALOG[to].sortOrder;
  return toOrder > fromOrder ? "upgrade" : "downgrade";
}

export type PlanUsageExcess = {
  resource: LimitResource;
  used: number;
  limit: number;
  reduceBy: number;
};

/** Resources whose current usage would exceed `limits` (unlimited `null` is never excess). */
export function usageExceedsLimits(
  used: Partial<Record<LimitResource, number>>,
  limits: PlanLimits,
): PlanUsageExcess[] {
  const excess: PlanUsageExcess[] = [];
  for (const resource of Object.keys(limits) as LimitResource[]) {
    const limit = limits[resource];
    if (limit === null) continue;
    const current = used[resource] ?? 0;
    if (current > limit) {
      excess.push({ resource, used: current, limit, reduceBy: current - limit });
    }
  }
  return excess;
}
