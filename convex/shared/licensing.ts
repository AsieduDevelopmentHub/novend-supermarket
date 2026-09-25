/**
 * Pure licensing rules: access derivation, usage levels and alert thresholds.
 *
 * Kept free of Convex and React imports so the same rules run on the server,
 * in the browser (including from the offline license cache) and in unit tests.
 */

import type { LimitResource, PlanKey, SellablePlanKey } from "./plans";
import type { PlanCapabilities } from "./capabilities";
import type { CloudMode } from "./cloudMode";
import type { ResolvedExperienceTokens } from "./experience";
import { DEFAULT_NOVEND_EXPERIENCE } from "./experience";
import { FEATURE_KEYS, FEATURE_REGISTRY, type FeatureKey } from "./features";
import {
  featuresFromPlan,
  type BillingVisibility,
  type ResolvedOrganizationConfig,
} from "./organizationConfig";

export const ORGANIZATION_STATUSES = [
  "active",
  "trial",
  "suspended",
  "expired",
  "disabled",
  /** Legacy value from before licensing; treated as `disabled`. */
  "inactive",
] as const;

export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "expired",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Days a lapsed subscription keeps full access. Protects businesses from losing
 * the counter because of a failed card or a bank delay.
 */
export const GRACE_PERIOD_DAYS = 7;

export const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

/**
 * How long a cached licence stays trusted while the device is offline. Longer
 * than the grace period on purpose: connectivity loss must never stop selling.
 */
export const OFFLINE_LICENSE_TTL_DAYS = 30;

export const OFFLINE_LICENSE_TTL_MS = OFFLINE_LICENSE_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Informational heads-up when a metered resource is getting full. */
export const USAGE_INFO_RATIO = 0.8;

/** Strong warning just before the create path is blocked. */
export const USAGE_WARNING_RATIO = 0.95;

export type AccessState = "active" | "trial" | "grace" | "suspended" | "expired" | "disabled";

export type LicenseAccess = {
  state: AccessState;
  /** Sign in and read business data. */
  canRead: boolean;
  /** Create sales, move inventory and change records. */
  canWrite: boolean;
  /** Present tense explanation for the UI and for thrown errors. */
  reason: string | null;
  /** Milliseconds until the current state lapses, when known. */
  expiresAt: number | null;
};

export type SubscriptionSnapshot = {
  status: SubscriptionStatus;
  isLifetime: boolean;
  expiresAt?: number | null;
  graceUntil?: number | null;
  cancelAtPeriodEnd?: boolean;
};

const READ_ONLY_SUSPENDED =
  "This business is suspended. You can review existing records, but new activity is paused.";
const READ_ONLY_EXPIRED =
  "Your subscription has expired. Renew from Settings → Billing to start selling again.";
const BLOCKED_DISABLED = "This business has been disabled. Contact Novend support.";

/**
 * Single place that decides what a licence permits. Organization status set by a
 * platform admin always wins; otherwise the subscription decides.
 */
export function deriveAccess(
  organizationStatus: OrganizationStatus,
  subscription: SubscriptionSnapshot | null,
  now: number,
): LicenseAccess {
  if (organizationStatus === "disabled" || organizationStatus === "inactive") {
    return {
      state: "disabled",
      canRead: false,
      canWrite: false,
      reason: BLOCKED_DISABLED,
      expiresAt: null,
    };
  }
  if (organizationStatus === "suspended") {
    return {
      state: "suspended",
      canRead: true,
      canWrite: false,
      reason: READ_ONLY_SUSPENDED,
      expiresAt: null,
    };
  }

  if (!subscription) {
    if (organizationStatus === "expired") {
      return {
        state: "expired",
        canRead: true,
        canWrite: false,
        reason: READ_ONLY_EXPIRED,
        expiresAt: null,
      };
    }
    return { state: "active", canRead: true, canWrite: true, reason: null, expiresAt: null };
  }

  if (subscription.isLifetime) {
    return { state: "active", canRead: true, canWrite: true, reason: null, expiresAt: null };
  }

  const expiresAt = subscription.expiresAt ?? null;
  const graceUntil = subscription.graceUntil ?? (expiresAt ? expiresAt + GRACE_PERIOD_MS : null);
  const lapsed = expiresAt !== null && now > expiresAt;

  // A Paystack disable (or cancel-at-period-end) must not lock POS while the
  // current paid period is still running.
  if (subscription.status === "cancelled" && !lapsed) {
    return {
      state: "active",
      canRead: true,
      canWrite: true,
      reason: "This plan ends at the close of the current period. POS stays available until then.",
      expiresAt,
    };
  }

  if (subscription.status === "expired" || lapsed) {
    if (graceUntil !== null && now <= graceUntil) {
      return {
        state: "grace",
        canRead: true,
        canWrite: true,
        reason: "Payment is overdue. Renew now to avoid interruption.",
        expiresAt: graceUntil,
      };
    }
    return {
      state: "expired",
      canRead: true,
      canWrite: false,
      reason: READ_ONLY_EXPIRED,
      expiresAt,
    };
  }

  if (subscription.status === "past_due") {
    return {
      state: "grace",
      canRead: true,
      canWrite: true,
      reason: "Your last payment failed. Update payment to keep your subscription active.",
      expiresAt: graceUntil,
    };
  }

  if (subscription.status === "trialing" || organizationStatus === "trial") {
    return {
      state: "trial",
      canRead: true,
      canWrite: true,
      reason: "You're on a free trial. Choose a plan before it ends to keep selling.",
      expiresAt,
    };
  }

  return { state: "active", canRead: true, canWrite: true, reason: null, expiresAt };
}

export type UsageLevel = "ok" | "info" | "warning" | "full";

export type UsageMetric = {
  resource: LimitResource;
  used: number;
  limit: number | null;
  /** 0–100, capped. `0` when the resource is unlimited. */
  percent: number;
  level: UsageLevel;
  unlimited: boolean;
  remaining: number | null;
};

export function buildUsageMetric(
  resource: LimitResource,
  used: number,
  limit: number | null,
): UsageMetric {
  const safeUsed = Math.max(0, used);
  if (limit === null) {
    return {
      resource,
      used: safeUsed,
      limit: null,
      percent: 0,
      level: "ok",
      unlimited: true,
      remaining: null,
    };
  }
  const ratio = limit <= 0 ? 1 : safeUsed / limit;
  return {
    resource,
    used: safeUsed,
    limit,
    percent: Math.min(100, Math.round(ratio * 100)),
    level:
      ratio >= 1
        ? "full"
        : ratio >= USAGE_WARNING_RATIO
          ? "warning"
          : ratio >= USAGE_INFO_RATIO
            ? "info"
            : "ok",
    unlimited: false,
    remaining: Math.max(0, limit - safeUsed),
  };
}

export function hasCapacity(metric: UsageMetric, additional = 1): boolean {
  if (metric.unlimited || metric.limit === null) return true;
  return metric.used + additional <= metric.limit;
}

/** Trial length for organizations provisioned without a paid plan. */
export const TRIAL_PERIOD_DAYS = 14;

export const TRIAL_PERIOD_MS = TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000;

/** Tenant-safe commercial offer fields for offline billing UI (no internal notes). */
export type CommercialOfferSnapshot = {
  id: string;
  name: string;
  basePlanKey: SellablePlanKey;
  currency: string;
  monthlyPrice?: number | null;
  yearlyPrice?: number | null;
  lifetimePrice?: number | null;
  allowedCycles: Array<"monthly" | "yearly" | "lifetime">;
  customerMessage?: string | null;
};

export type LicenseCommercialSnapshot = {
  planKey: PlanKey;
  offerId?: string;
  canSelfServe: boolean;
  /** Present when a private offer is active/accepted — used by custom_offer_only UI. */
  offer?: CommercialOfferSnapshot | null;
};

export type LicenseSnapshot = {
  organizationId: string;
  organizationName: string;
  planKey: PlanKey;
  planName: string;
  organizationStatus: OrganizationStatus;
  /** Cloud usage mode. Older caches normalize via `normalizeCloudMode`. */
  cloudMode: CloudMode;
  /** Monotonic entitlement counter; older caches default to 0. */
  entitlementVersion: number;
  /**
   * Max of entitlement / experience / feature versions from resolveOrganizationConfig.
   * Older caches default to entitlementVersion.
   */
  configVersion: number;
  /** Cloud modes this organization may select. Missing override → all modes. */
  allowedCloudModes: CloudMode[];
  /** Platform toggle for cloud backups. Missing → true. */
  cloudBackupEnabled: boolean;
  /** Platform toggle for remote monitoring. Missing → true. */
  remoteMonitoringEnabled: boolean;
  subscription: SubscriptionSnapshot | null;
  access: LicenseAccess;
  limits: Record<LimitResource, number | null>;
  capabilities?: PlanCapabilities;
  /** Resolved feature entitlements (FEATURE_KEYS). */
  features: Record<FeatureKey, boolean>;
  /** Plan marketing bullet list (legacy `features` array on older caches). */
  planFeatures: string[];
  /** Semantic experience tokens for theme application. */
  experience: ResolvedExperienceTokens;
  billingVisibility: BillingVisibility;
  commercial: LicenseCommercialSnapshot;
  issuedAt: number;
  scheduledPlan?: PlanKey | null;
  scheduledEffectiveAt?: number | null;
  /** Owner self-service closure — org is read-only until `closureEffectiveAt`. */
  pendingClosure?: boolean;
  closureEffectiveAt?: number | null;
};

/** Secure defaults when an older offline cache omits entitlement fields. */
export function defaultLicenseEntitlements(planKey: PlanKey): {
  features: Record<FeatureKey, boolean>;
  experience: ResolvedExperienceTokens;
  billingVisibility: BillingVisibility;
  commercial: LicenseCommercialSnapshot;
  configVersion: number;
} {
  const features = featuresFromPlan(planKey);
  return {
    features,
    experience: { ...DEFAULT_NOVEND_EXPERIENCE },
    billingVisibility: "visible",
    commercial: {
      planKey,
      canSelfServe: features["billing.selfServeCheckout"],
      offer: null,
    },
    configVersion: 0,
  };
}

export function featureEnabled(
  features: Record<FeatureKey, boolean> | null | undefined,
  key: FeatureKey,
): boolean {
  if (!features) return FEATURE_REGISTRY[key].defaultEnabled;
  return features[key] === true;
}

/** Builds the entitlement slice of a licence from a resolved org config. */
export function entitlementsFromResolvedConfig(
  config: ResolvedOrganizationConfig,
  offer?: CommercialOfferSnapshot | null,
): Pick<
  LicenseSnapshot,
  "features" | "experience" | "billingVisibility" | "commercial" | "configVersion"
> {
  return {
    features: config.features,
    experience: config.experience,
    billingVisibility: config.billingVisibility,
    commercial: {
      planKey: config.commercial.planKey,
      offerId: config.commercial.offerId,
      canSelfServe: config.commercial.canSelfServe,
      offer: offer ?? null,
    },
    configVersion: config.version,
  };
}

export function emptyFeatureRecord(enabled = false): Record<FeatureKey, boolean> {
  const record = {} as Record<FeatureKey, boolean>;
  for (const key of FEATURE_KEYS) {
    record[key] = enabled;
  }
  return record;
}

/**
 * Re-evaluates a cached snapshot on the client. Devices that stay offline past
 * the cache TTL fall back to read-only rather than losing the app entirely.
 */
export function evaluateCachedLicense(
  snapshot: LicenseSnapshot,
  now: number,
): LicenseAccess & { stale: boolean } {
  const access = deriveAccess(snapshot.organizationStatus, snapshot.subscription, now);
  // Lifetime licences and explicitly local-only organizations are designed to
  // operate without periodic business-cloud checks. Their cached entitlement
  // still enforces suspension, disablement, and subscription access rules.
  const perpetualOffline =
    snapshot.planKey === "lifetime" ||
    snapshot.subscription?.isLifetime === true ||
    snapshot.cloudMode === "local_only";
  const stale = !perpetualOffline && now - snapshot.issuedAt > OFFLINE_LICENSE_TTL_MS;
  if (!stale) return { ...access, stale };
  return {
    ...access,
    canWrite: false,
    state: access.canWrite ? "expired" : access.state,
    reason: "This device has been offline too long to confirm your licence. Reconnect to continue.",
    stale,
  };
}
