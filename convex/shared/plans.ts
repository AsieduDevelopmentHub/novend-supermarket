/**
 * Commercial plan seed catalog + pure helpers.
 *
 * Runtime marketing / entitlements prefer the `plans` table (admin-editable).
 * This module seeds defaults, falls back when a row is missing, and keeps
 * price/limit math importable from Convex, Next, and tests without a DB.
 *
 * `null` limit means unlimited.
 */

export const SEED_PLAN_KEYS = [
  "starter",
  "shop",
  "basic",
  "growth",
  "pro",
  "business",
  "enterprise",
  "lifetime",
] as const;

/** @deprecated Prefer SEED_PLAN_KEYS — kept as alias for older imports. */
export const PLAN_KEYS = SEED_PLAN_KEYS;

export type SeedPlanKey = (typeof SEED_PLAN_KEYS)[number];
/** Stored plan key (slug). Seed keys plus any Super Admin–created plans. */
export type PlanKey = string;

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
  /** Show on public marketing (homepage trio + /pricing). */
  marketingVisible: boolean;
  /** Homepage pricing preview (at most three). */
  homepageHighlight: boolean;
  /**
   * When true, the plan is retained for historical subscriptions only and must
   * not appear in public pricing or new self-serve sales.
   */
  legacy?: boolean;
  archived?: boolean;
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

/** Floor for sellable monthly prices (GHS major units). */
export const MIN_MONTHLY_PRICE_GHS = 99;

/** Floor for sellable product caps (Enterprise unlimited exempt). */
export const MIN_PRODUCT_LIMIT = 100;

/** Default psychological list-price markup (%). Charged amount stays the real price. */
export const DEFAULT_LIST_PRICE_MARKUP_PERCENT = 20;

/** Sort order at/above which Pro-tier capabilities unlock (xlsx, customer display, …). */
export const PRO_CAPABILITY_MIN_SORT_ORDER = 5;

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

/** Psychological “was” price — never below the real charge. */
export function listPriceFromReal(real: number, markupPercent: number): number {
  if (!Number.isFinite(real) || real <= 0) return real;
  const pct = Math.min(90, Math.max(0, markupPercent));
  return Math.ceil(real * (1 + pct / 100));
}

export function clampListPriceMarkupPercent(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LIST_PRICE_MARKUP_PERCENT;
  return Math.min(90, Math.max(0, Math.round(n)));
}

/** Marketing bullet inheritance: `"Everything in Starter"`. */
const EVERYTHING_IN_FEATURE = /^Everything in (.+)$/i;

export function parsePlanInheritanceTarget(feature: string): string | null {
  const match = feature.trim().match(EVERYTHING_IN_FEATURE);
  const target = match?.[1]?.trim();
  return target ? target : null;
}

export type PlanFeatureSource = {
  key: string;
  name: string;
  features: readonly string[];
};

/**
 * Expand `"Everything in {PlanName}"` into concrete feature bullets.
 * Inheritance lines themselves are omitted from the result.
 */
export function resolvePlanFeatures(
  plan: PlanFeatureSource,
  catalog: readonly PlanFeatureSource[],
): string[] {
  const byName = new Map(
    catalog.map((entry) => [entry.name.trim().toLowerCase(), entry] as const),
  );
  const result: string[] = [];
  const seen = new Set<string>();
  const visiting = new Set<string>();

  function walk(current: PlanFeatureSource) {
    if (visiting.has(current.key)) return;
    visiting.add(current.key);
    for (const feature of current.features) {
      const parentName = parsePlanInheritanceTarget(feature);
      if (parentName) {
        const parent = byName.get(parentName.toLowerCase());
        if (parent) walk(parent);
        continue;
      }
      if (!seen.has(feature)) {
        seen.add(feature);
        result.push(feature);
      }
    }
    visiting.delete(current.key);
  }

  walk(plan);
  return result;
}

/**
 * Comparison-matrix rows and per-plan resolved feature sets.
 * Walks plans in the given order (callers should sort by sortOrder ascending)
 * so lower-tier bullets appear first.
 */
export function collectComparablePlanFeatures(plans: readonly PlanFeatureSource[]): {
  rows: string[];
  resolvedByKey: Map<string, ReadonlySet<string>>;
} {
  const resolvedByKey = new Map<string, ReadonlySet<string>>();
  const rows: string[] = [];
  const rowSeen = new Set<string>();

  for (const plan of plans) {
    const resolved = resolvePlanFeatures(plan, plans);
    resolvedByKey.set(plan.key, new Set(resolved));
    for (const feature of resolved) {
      if (rowSeen.has(feature)) continue;
      rowSeen.add(feature);
      rows.push(feature);
    }
  }

  return { rows, resolvedByKey };
}

export const PLAN_CATALOG: Record<SeedPlanKey, PlanDefinition> = {
  starter: {
    key: "starter",
    name: "Starter",
    tagline: "Start selling with a lean catalogue and one till.",
    audience: "New shops and solo sellers",
    monthlyPrice: 99,
    yearlyPrice: yearlyPriceFromMonthly(99),
    oneTimePrice: null,
    priceFrom: false,
    variableBackup: false,
    isLifetime: false,
    featured: false,
    selfServe: true,
    marketingVisible: true,
    homepageHighlight: true,
    sortOrder: 1,
    limits: {
      products: 100,
      users: 1,
      branches: 1,
      devices: 1,
      backupBytes: 100 * MEBIBYTE,
    },
    features: [
      "Offline POS",
      "Inventory",
      "Products & categories",
      "Customers",
      "Barcode (camera)",
      "Receipt printing",
      "Returns",
      "Basic reports",
    ],
  },
  shop: {
    key: "shop",
    name: "Shop",
    tagline: "A second user and more stock for a busy counter.",
    audience: "Small retail shops",
    monthlyPrice: 139,
    yearlyPrice: yearlyPriceFromMonthly(139),
    oneTimePrice: null,
    priceFrom: false,
    variableBackup: false,
    isLifetime: false,
    featured: false,
    selfServe: true,
    marketingVisible: true,
    homepageHighlight: false,
    sortOrder: 2,
    limits: {
      products: 250,
      users: 2,
      branches: 1,
      devices: 2,
      backupBytes: 150 * MEBIBYTE,
    },
    features: [
      "Everything in Starter",
      "Suppliers",
      "Expenses",
      "Hardware barcode",
      "Analytics lite",
    ],
  },
  basic: {
    key: "basic",
    name: "Basic",
    tagline: "Everything a single shop needs to sell and track stock.",
    audience: "Small retail businesses",
    monthlyPrice: 199,
    yearlyPrice: yearlyPriceFromMonthly(199),
    oneTimePrice: null,
    priceFrom: false,
    variableBackup: false,
    isLifetime: false,
    featured: false,
    selfServe: true,
    marketingVisible: true,
    homepageHighlight: false,
    sortOrder: 3,
    limits: {
      products: 500,
      users: 3,
      branches: 1,
      devices: 3,
      backupBytes: 250 * MEBIBYTE,
    },
    features: [
      "Everything in Shop",
      "Customers & suppliers",
      "Barcode (camera & hardware)",
      "Returns",
      "Expenses",
      "Reports",
      "Analytics",
    ],
  },
  growth: {
    key: "growth",
    name: "Growth",
    tagline: "Two branches and a larger team as you expand.",
    audience: "Growing retailers",
    monthlyPrice: 279,
    yearlyPrice: yearlyPriceFromMonthly(279),
    oneTimePrice: null,
    priceFrom: false,
    variableBackup: false,
    isLifetime: false,
    featured: false,
    selfServe: true,
    marketingVisible: true,
    homepageHighlight: false,
    sortOrder: 4,
    limits: {
      products: 1000,
      users: 5,
      branches: 2,
      devices: 5,
      backupBytes: 350 * MEBIBYTE,
    },
    features: [
      "Everything in Basic",
      "Second branch",
      "Branch transfers",
      "More staff seats",
    ],
  },
  pro: {
    key: "pro",
    name: "Pro",
    tagline: "Wholesale, branches and analytics for growing businesses.",
    audience: "Supermarkets, pharmacies and wholesalers",
    monthlyPrice: 459,
    yearlyPrice: yearlyPriceFromMonthly(459),
    oneTimePrice: null,
    priceFrom: false,
    variableBackup: false,
    isLifetime: false,
    featured: true,
    selfServe: true,
    marketingVisible: true,
    homepageHighlight: true,
    sortOrder: 5,
    limits: {
      products: 5000,
      users: 15,
      branches: 5,
      devices: 15,
      backupBytes: 500 * MEBIBYTE,
    },
    features: [
      "Everything in Growth",
      "Wholesale inventory",
      "Multi-branch management",
      "Advanced analytics",
      "Staff salary and commission",
      "Customer display",
      "Excel & PDF export",
      "Priority support",
    ],
  },
  business: {
    key: "business",
    name: "Business",
    tagline: "Higher caps for multi-site operations before Enterprise.",
    audience: "Regional chains and distributors",
    monthlyPrice: 659,
    yearlyPrice: yearlyPriceFromMonthly(659),
    oneTimePrice: null,
    priceFrom: false,
    variableBackup: false,
    isLifetime: false,
    featured: false,
    selfServe: true,
    marketingVisible: true,
    homepageHighlight: false,
    sortOrder: 6,
    limits: {
      products: 15000,
      users: 30,
      branches: 10,
      devices: 30,
      backupBytes: 1 * GIBIBYTE,
    },
    features: [
      "Everything in Pro",
      "Larger catalogue & team",
      "More branches and devices",
      "1 GB cloud backup",
    ],
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    tagline: "Unlimited scale with dedicated onboarding and support.",
    audience: "Multi-branch groups and distributors",
    monthlyPrice: 899,
    yearlyPrice: yearlyPriceFromMonthly(899),
    oneTimePrice: null,
    priceFrom: true,
    variableBackup: true,
    isLifetime: false,
    featured: false,
    selfServe: true,
    marketingVisible: true,
    homepageHighlight: true,
    sortOrder: 7,
    limits: {
      products: null,
      users: null,
      branches: null,
      devices: null,
      backupBytes: null,
    },
    features: [
      "Everything in Business",
      "Unlimited products, users, branches, devices",
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
    /** Legacy — not sold; kept for historical subscriptions and offline licences. */
    selfServe: false,
    marketingVisible: false,
    homepageHighlight: false,
    legacy: true,
    sortOrder: 8,
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

/**
 * Fallback for unknown / legacy plan strings. Must never resolve to the most
 * powerful entitlement set — Basic is the secure default.
 */
export const DEFAULT_PLAN_KEY: SeedPlanKey = "basic";

/** Plans offered for new sales and public pricing (excludes legacy Lifetime). */
export const SELLABLE_PLAN_KEYS = [
  "starter",
  "shop",
  "basic",
  "growth",
  "pro",
  "business",
  "enterprise",
] as const;

/** Sellable plan slug — seed keys plus Super Admin–created plans. */
export type SellablePlanKey = string;

export const PLAN_LIST: PlanDefinition[] = SEED_PLAN_KEYS.map((key) => PLAN_CATALOG[key]).sort(
  (a, b) => a.sortOrder - b.sortOrder,
);

export const SELLABLE_PLAN_LIST: PlanDefinition[] = SELLABLE_PLAN_KEYS.map(
  (key) => PLAN_CATALOG[key],
).sort((a, b) => a.sortOrder - b.sortOrder);

export function isSellablePlanKey(value: unknown): value is SellablePlanKey {
  if (typeof value !== "string" || !value) return false;
  if (value === "lifetime") return false;
  // Seed sellable keys plus any Super Admin–created slug.
  return (SELLABLE_PLAN_KEYS as readonly string[]).includes(value) || isValidPlanKeySlug(value);
}

export function isSeedPlanKey(value: unknown): value is SeedPlanKey {
  return typeof value === "string" && (SEED_PLAN_KEYS as readonly string[]).includes(value);
}

/** @deprecated Use isSeedPlanKey — historical name. */
export function isPlanKey(value: unknown): value is SeedPlanKey {
  return isSeedPlanKey(value);
}

export function isValidPlanKeySlug(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9_]{1,47}$/.test(value);
}

/**
 * Resolves a stored plan value to a seed definition. Unknown values fall back
 * to Basic — never Lifetime/Enterprise. Prefer DB rows at entitlement time.
 */
export function resolvePlan(value: unknown): PlanDefinition {
  if (isSeedPlanKey(value)) return PLAN_CATALOG[value];
  return PLAN_CATALOG[DEFAULT_PLAN_KEY];
}

export function planLimit(planKey: PlanKey, resource: LimitResource): number | null {
  return resolvePlan(planKey).limits[resource];
}

export const MIN_CUSTOM_BACKUP_GB = 1;
export const MAX_CUSTOM_BACKUP_GB = 1024;

export type LimitOverrides = {
  products?: number | null;
  users?: number | null;
  branches?: number | null;
  devices?: number | null;
};

function applyLimitOverrides(base: PlanLimits, overrides?: LimitOverrides | null): PlanLimits {
  if (!overrides) return base;
  return {
    products: overrides.products !== undefined ? overrides.products : base.products,
    users: overrides.users !== undefined ? overrides.users : base.users,
    branches: overrides.branches !== undefined ? overrides.branches : base.branches,
    devices: overrides.devices !== undefined ? overrides.devices : base.devices,
    backupBytes: base.backupBytes,
  };
}

/**
 * Catalog limits with Enterprise backup quota and layered overrides.
 * Precedence: plan → commercial offer → organization (org always wins).
 * Absent keys inherit the previous layer.
 */
export function effectivePlanLimits(
  plan: PlanDefinition,
  organizationBackupLimitBytes?: number | null,
  organizationOverrides?: LimitOverrides | null,
  offerOverrides?: LimitOverrides | null,
): PlanLimits {
  const base: PlanLimits = plan.variableBackup
    ? { ...plan.limits, backupBytes: organizationBackupLimitBytes ?? null }
    : plan.limits;
  return applyLimitOverrides(applyLimitOverrides(base, offerOverrides), organizationOverrides);
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
  const plan = resolvePlan(planKey);
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
  const fromOrder = resolvePlan(from).sortOrder;
  const toOrder = resolvePlan(to).sortOrder;
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

/** Map a DB `plans` document into the shared PlanDefinition shape. */
export function planDefinitionFromRow(row: {
  key: string;
  name: string;
  description?: string;
  tagline?: string;
  audience?: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  oneTimePrice: number | null;
  productLimit: number | null;
  userLimit: number | null;
  branchLimit: number | null;
  deviceLimit: number | null;
  backupLimitBytes: number | null;
  features: string[];
  isLifetime: boolean;
  sortOrder: number;
  priceFrom?: boolean;
  variableBackup?: boolean;
  featured?: boolean;
  selfServe?: boolean;
  marketingVisible?: boolean;
  homepageHighlight?: boolean;
  legacy?: boolean;
  archived?: boolean;
}): PlanDefinition {
  const seed = isSeedPlanKey(row.key) ? PLAN_CATALOG[row.key] : null;
  return {
    key: row.key,
    name: row.name,
    tagline: row.tagline ?? row.description ?? seed?.tagline ?? "",
    audience: row.audience ?? seed?.audience ?? "",
    monthlyPrice: row.monthlyPrice,
    yearlyPrice: row.yearlyPrice,
    oneTimePrice: row.oneTimePrice,
    priceFrom: row.priceFrom ?? seed?.priceFrom ?? false,
    variableBackup: row.variableBackup ?? seed?.variableBackup ?? false,
    isLifetime: row.isLifetime,
    featured: row.featured ?? seed?.featured ?? false,
    selfServe: row.selfServe ?? seed?.selfServe ?? !row.isLifetime,
    marketingVisible: row.marketingVisible ?? seed?.marketingVisible ?? false,
    homepageHighlight: row.homepageHighlight ?? seed?.homepageHighlight ?? false,
    legacy: row.legacy ?? seed?.legacy,
    archived: row.archived ?? false,
    sortOrder: row.sortOrder,
    limits: {
      products: row.productLimit,
      users: row.userLimit,
      branches: row.branchLimit,
      devices: row.deviceLimit,
      backupBytes: row.backupLimitBytes,
    },
    features: row.features,
  };
}
