/**
 * Offline licence cache.
 *
 * Convex stays authoritative for entitlements, but a terminal that loses
 * connectivity must keep selling. The last confirmed licence is stored in the
 * offline database and re-evaluated locally; see `OFFLINE_LICENSE_TTL_MS` in
 * `convex/shared/licensing.ts` for how long a cached licence stays trusted.
 *
 * Lifetime / local-only orgs also mirror the snapshot to an org-scoped
 * localStorage key so every staff replica on this device can sell offline —
 * not only the last user who pulled billing.
 */
import {
  ORGANIZATION_STATUSES,
  SUBSCRIPTION_STATUSES,
  defaultLicenseEntitlements,
  evaluateCachedLicense,
  type CommercialOfferSnapshot,
  type LicenseAccess,
  type LicenseCommercialSnapshot,
  type LicenseSnapshot,
  type SubscriptionSnapshot,
} from "@/convex/shared/licensing";
import { normalizeCloudMode } from "@/convex/shared/cloudMode";
import {
  DEFAULT_NOVEND_EXPERIENCE,
  type ExperienceRadiusScale,
  type ResolvedExperienceTokens,
  validateHexColor,
} from "@/convex/shared/experience";
import { FEATURE_KEYS, type FeatureKey } from "@/convex/shared/features";
import type { BillingVisibility } from "@/convex/shared/organizationConfig";
import { isPlanKey, isSellablePlanKey } from "@/convex/shared/plans";
import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";

export type CachedLicense = LicenseSnapshot & {
  access: LicenseAccess & { stale: boolean };
};

export type OfflineLicenseState =
  | { kind: "first_activation_required"; snapshot: null; access: CachedLicense["access"] }
  | { kind: "recovery_required"; snapshot: null; access: CachedLicense["access"] }
  | { kind: "valid"; snapshot: CachedLicense; access: CachedLicense["access"] }
  | { kind: "stale"; snapshot: CachedLicense; access: CachedLicense["access"] }
  | { kind: "perpetual"; snapshot: CachedLicense; access: CachedLicense["access"] };

export const FIRST_ACTIVATION_REQUIRED =
  "Connect to the internet and activate this installation before recording sales or other activity.";
export const LICENSE_RECOVERY_REQUIRED =
  "Licence recovery is required. This installation is read-only because its saved licence is missing or damaged. Reconnect to restore access.";

const ORG_LICENSE_PREFIX = "novend.license.org.";

const BLOCKED_ACCESS = (reason: string): CachedLicense["access"] => ({
  state: "expired",
  canRead: true,
  canWrite: false,
  reason,
  expiresAt: null,
  stale: false,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalTimestamp(value: unknown): boolean {
  return (
    value === undefined || value === null || (typeof value === "number" && Number.isFinite(value))
  );
}

function isSubscription(value: unknown): value is SubscriptionSnapshot | null {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return (
    typeof value.status === "string" &&
    (SUBSCRIPTION_STATUSES as readonly string[]).includes(value.status) &&
    typeof value.isLifetime === "boolean" &&
    isOptionalTimestamp(value.expiresAt) &&
    isOptionalTimestamp(value.graceUntil) &&
    (value.cancelAtPeriodEnd === undefined || typeof value.cancelAtPeriodEnd === "boolean")
  );
}

function parseHexField(value: unknown, fallback: string): string {
  const validated = validateHexColor(value);
  return validated.ok ? validated.value : fallback;
}

function parseExperience(value: unknown): ResolvedExperienceTokens {
  if (!isRecord(value)) return { ...DEFAULT_NOVEND_EXPERIENCE };
  const radius = value.radiusScale;
  const radiusScale: ExperienceRadiusScale =
    radius === "compact" || radius === "soft" || radius === "default" ? radius : "default";
  return {
    accent: parseHexField(value.accent, DEFAULT_NOVEND_EXPERIENCE.accent),
    accentForeground: parseHexField(
      value.accentForeground,
      DEFAULT_NOVEND_EXPERIENCE.accentForeground,
    ),
    sidebarBackground: parseHexField(
      value.sidebarBackground,
      DEFAULT_NOVEND_EXPERIENCE.sidebarBackground,
    ),
    sidebarForeground: parseHexField(
      value.sidebarForeground,
      DEFAULT_NOVEND_EXPERIENCE.sidebarForeground,
    ),
    sidebarAccent: parseHexField(value.sidebarAccent, DEFAULT_NOVEND_EXPERIENCE.sidebarAccent),
    sidebarAccentForeground: parseHexField(
      value.sidebarAccentForeground,
      DEFAULT_NOVEND_EXPERIENCE.sidebarAccentForeground,
    ),
    focusRing: parseHexField(value.focusRing, DEFAULT_NOVEND_EXPERIENCE.focusRing),
    success: parseHexField(value.success, DEFAULT_NOVEND_EXPERIENCE.success),
    warning: parseHexField(value.warning, DEFAULT_NOVEND_EXPERIENCE.warning),
    danger: parseHexField(value.danger, DEFAULT_NOVEND_EXPERIENCE.danger),
    radiusScale,
  };
}

function parseFeatureRecord(
  value: unknown,
  planKey: LicenseSnapshot["planKey"],
): Record<FeatureKey, boolean> {
  const defaults = defaultLicenseEntitlements(planKey).features;
  if (!isRecord(value)) return defaults;
  const next = { ...defaults };
  for (const key of FEATURE_KEYS) {
    if (typeof value[key] === "boolean") {
      next[key] = value[key];
    }
  }
  return next;
}

function parseBillingVisibility(value: unknown): BillingVisibility {
  if (value === "hidden" || value === "custom_offer_only" || value === "visible") {
    return value;
  }
  return "visible";
}

function parseCommercialOffer(value: unknown): CommercialOfferSnapshot | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !value.id) return null;
  if (typeof value.name !== "string") return null;
  if (!isSellablePlanKey(value.basePlanKey)) return null;
  if (typeof value.currency !== "string") return null;
  if (!Array.isArray(value.allowedCycles)) return null;
  const cycles = value.allowedCycles.filter(
    (c): c is "monthly" | "yearly" => c === "monthly" || c === "yearly",
  );
  if (cycles.length === 0) return null;
  return {
    id: value.id,
    name: value.name,
    basePlanKey: value.basePlanKey,
    currency: value.currency,
    monthlyPrice:
      value.monthlyPrice === null || value.monthlyPrice === undefined
        ? null
        : typeof value.monthlyPrice === "number"
          ? value.monthlyPrice
          : null,
    yearlyPrice:
      value.yearlyPrice === null || value.yearlyPrice === undefined
        ? null
        : typeof value.yearlyPrice === "number"
          ? value.yearlyPrice
          : null,
    allowedCycles: cycles,
    customerMessage: typeof value.customerMessage === "string" ? value.customerMessage : null,
  };
}

function parseCommercial(
  value: unknown,
  planKey: LicenseSnapshot["planKey"],
  features: Record<FeatureKey, boolean>,
): LicenseCommercialSnapshot {
  const defaults = defaultLicenseEntitlements(planKey).commercial;
  if (!isRecord(value)) {
    return { ...defaults, canSelfServe: features["billing.selfServeCheckout"] };
  }
  return {
    planKey: isPlanKey(value.planKey) ? value.planKey : planKey,
    offerId: typeof value.offerId === "string" ? value.offerId : undefined,
    canSelfServe:
      typeof value.canSelfServe === "boolean"
        ? value.canSelfServe
        : features["billing.selfServeCheckout"],
    offer: parseCommercialOffer(value.offer),
  };
}

function parseSnapshot(raw: string): LicenseSnapshot | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    if (typeof value.organizationId !== "string" || !value.organizationId) return null;
    if (typeof value.organizationName !== "string") return null;
    if (!isPlanKey(value.planKey)) return null;
    if (typeof value.planName !== "string") return null;
    if (
      typeof value.organizationStatus !== "string" ||
      !(ORGANIZATION_STATUSES as readonly string[]).includes(value.organizationStatus)
    ) {
      return null;
    }
    if (!isSubscription(value.subscription)) return null;
    if (!isRecord(value.limits)) return null;
    for (const resource of ["products", "users", "branches", "devices", "backupBytes"]) {
      const limit = value.limits[resource];
      if (limit !== null && (typeof limit !== "number" || !Number.isFinite(limit) || limit < 0)) {
        return null;
      }
    }
    if (typeof value.issuedAt !== "number" || !Number.isFinite(value.issuedAt)) return null;

    // Lifetime plans must stay perpetual offline even when an older cache omitted
    // `subscription.isLifetime` or left subscription null after a billing quirk.
    const planKey = value.planKey;
    let subscription = value.subscription as SubscriptionSnapshot | null;
    if (planKey === "lifetime") {
      if (!subscription) {
        subscription = { status: "active", isLifetime: true, expiresAt: null, graceUntil: null };
      } else if (!subscription.isLifetime) {
        subscription = { ...subscription, isLifetime: true };
      }
    }

    const defaults = defaultLicenseEntitlements(planKey);

    // Backward compat: older caches stored plan marketing bullets as `features: string[]`.
    let planFeatures: string[] = [];
    let features: Record<FeatureKey, boolean> = defaults.features;
    if (Array.isArray(value.features) && value.features.every((item) => typeof item === "string")) {
      planFeatures = value.features as string[];
    } else if (isRecord(value.features)) {
      features = parseFeatureRecord(value.features, planKey);
    }
    if (Array.isArray(value.planFeatures) && value.planFeatures.every((f) => typeof f === "string")) {
      planFeatures = value.planFeatures as string[];
    }

    const entitlementVersion =
      typeof value.entitlementVersion === "number" ? value.entitlementVersion : 0;
    const configVersion =
      typeof value.configVersion === "number" ? value.configVersion : entitlementVersion;

    return {
      ...(value as unknown as LicenseSnapshot),
      subscription,
      cloudMode: normalizeCloudMode(value.cloudMode),
      entitlementVersion,
      configVersion,
      allowedCloudModes: Array.isArray(value.allowedCloudModes)
        ? value.allowedCloudModes.map(normalizeCloudMode)
        : ["full_sync", "backup_only", "local_only"],
      cloudBackupEnabled: value.cloudBackupEnabled !== false,
      remoteMonitoringEnabled: value.remoteMonitoringEnabled !== false,
      features,
      planFeatures,
      experience: parseExperience(value.experience),
      billingVisibility: parseBillingVisibility(value.billingVisibility),
      commercial: parseCommercial(value.commercial, planKey, features),
    };
  } catch {
    return null;
  }
}

function orgLicenseStorageKey(organizationId: string) {
  return `${ORG_LICENSE_PREFIX}${organizationId}`;
}

/** Shared across staff replicas on this device so lifetime stays sellable offline. */
export function readOrgLicenseCache(organizationId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(orgLicenseStorageKey(organizationId));
  } catch {
    return null;
  }
}

export function writeOrgLicenseCache(organizationId: string, raw: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(orgLicenseStorageKey(organizationId), raw);
  } catch {
    /* private mode / quota */
  }
}

export function clearOrgLicenseCache(organizationId?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (organizationId) {
      window.localStorage.removeItem(orgLicenseStorageKey(organizationId));
      return;
    }
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(ORG_LICENSE_PREFIX)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Pure state resolver used by the cache loader and the licence state-matrix tests. */
export function resolveOfflineLicenseState(input: {
  raw: string | null;
  activatedBefore: boolean;
  establishedOrganizationId?: string | null;
  now?: number;
}): OfflineLicenseState {
  const now = input.now ?? Date.now();
  if (!input.raw) {
    const recovery = input.activatedBefore || Boolean(input.establishedOrganizationId);
    const reason = recovery ? LICENSE_RECOVERY_REQUIRED : FIRST_ACTIVATION_REQUIRED;
    return {
      kind: recovery ? "recovery_required" : "first_activation_required",
      snapshot: null,
      access: BLOCKED_ACCESS(reason),
    };
  }

  const snapshot = parseSnapshot(input.raw);
  if (
    !snapshot ||
    (input.establishedOrganizationId && snapshot.organizationId !== input.establishedOrganizationId)
  ) {
    return {
      kind: "recovery_required",
      snapshot: null,
      access: BLOCKED_ACCESS(LICENSE_RECOVERY_REQUIRED),
    };
  }

  const cached: CachedLicense = {
    ...snapshot,
    access: evaluateCachedLicense(snapshot, now),
  };
  const perpetual =
    snapshot.cloudMode === "local_only" ||
    snapshot.planKey === "lifetime" ||
    snapshot.subscription?.isLifetime === true;
  return {
    kind: perpetual ? "perpetual" : cached.access.stale ? "stale" : "valid",
    snapshot: cached,
    access: cached.access,
  };
}

export async function saveLicenseSnapshot(snapshot: LicenseSnapshot): Promise<void> {
  const raw = JSON.stringify(snapshot);
  writeOrgLicenseCache(snapshot.organizationId, raw);
  const db = await getOfflineDb();
  if (!db) return;
  await db.transaction("rw", db.meta, async () => {
    await setMeta(db, META_KEYS.licenseSnapshot, raw);
    await setMeta(db, META_KEYS.licenseActivated, "1");
  });
}

export async function loadOfflineLicenseState(now = Date.now()): Promise<OfflineLicenseState> {
  const db = await getOfflineDb();
  if (!db) {
    // Dexie unavailable — still honour a device-level org licence (lifetime tills).
    if (typeof window !== "undefined") {
      try {
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const key = window.localStorage.key(i);
          if (!key?.startsWith(ORG_LICENSE_PREFIX)) continue;
          const raw = window.localStorage.getItem(key);
          if (!raw) continue;
          const state = resolveOfflineLicenseState({
            raw,
            activatedBefore: true,
            now,
          });
          if (state.snapshot) return state;
        }
      } catch {
        /* ignore */
      }
    }
    return {
      kind: "recovery_required",
      snapshot: null,
      access: BLOCKED_ACCESS(LICENSE_RECOVERY_REQUIRED),
    };
  }
  const [raw, activated, organizationId] = await Promise.all([
    getMeta(db, META_KEYS.licenseSnapshot),
    getMeta(db, META_KEYS.licenseActivated),
    getMeta(db, META_KEYS.profileOrganizationId),
  ]);

  let effectiveRaw = raw;
  const orgId = organizationId || undefined;
  if ((!effectiveRaw || !effectiveRaw.trim()) && orgId) {
    const shared = readOrgLicenseCache(orgId);
    if (shared) {
      effectiveRaw = shared;
      // Seed this staff replica so subsequent offline opens do not look "unactivated".
      await db.transaction("rw", db.meta, async () => {
        await setMeta(db, META_KEYS.licenseSnapshot, shared);
        await setMeta(db, META_KEYS.licenseActivated, "1");
      });
    }
  }

  const state = resolveOfflineLicenseState({
    raw: effectiveRaw,
    activatedBefore: activated === "1" || Boolean(effectiveRaw?.trim()),
    establishedOrganizationId: organizationId,
    now,
  });
  if (state.snapshot) {
    writeOrgLicenseCache(state.snapshot.organizationId, JSON.stringify(state.snapshot));
    if (activated !== "1") {
      await setMeta(db, META_KEYS.licenseActivated, "1");
    }
  }
  return state;
}

export async function loadLicenseSnapshot(now = Date.now()): Promise<CachedLicense | null> {
  return (await loadOfflineLicenseState(now)).snapshot;
}

export async function clearLicenseSnapshot(): Promise<void> {
  const db = await getOfflineDb();
  if (!db) return;
  await setMeta(db, META_KEYS.licenseSnapshot, "");
}
