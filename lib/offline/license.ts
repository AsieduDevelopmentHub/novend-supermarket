/**
 * Offline licence cache.
 *
 * Convex stays authoritative for entitlements, but a terminal that loses
 * connectivity must keep selling. The last confirmed licence is stored in the
 * offline database and re-evaluated locally; see `OFFLINE_LICENSE_TTL_MS` in
 * `convex/shared/licensing.ts` for how long a cached licence stays trusted.
 */
import {
  ORGANIZATION_STATUSES,
  SUBSCRIPTION_STATUSES,
  evaluateCachedLicense,
  type LicenseAccess,
  type LicenseSnapshot,
  type SubscriptionSnapshot,
} from "@/convex/shared/licensing";
import { normalizeCloudMode } from "@/convex/shared/cloudMode";
import { isPlanKey } from "@/convex/shared/plans";
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
    if (
      !Array.isArray(value.features) ||
      !value.features.every((item) => typeof item === "string")
    ) {
      return null;
    }
    if (typeof value.issuedAt !== "number" || !Number.isFinite(value.issuedAt)) return null;

    return {
      ...(value as unknown as LicenseSnapshot),
      cloudMode: normalizeCloudMode(value.cloudMode),
      entitlementVersion:
        typeof value.entitlementVersion === "number" ? value.entitlementVersion : 0,
      allowedCloudModes: Array.isArray(value.allowedCloudModes)
        ? value.allowedCloudModes.map(normalizeCloudMode)
        : ["full_sync", "backup_only", "local_only"],
      cloudBackupEnabled: value.cloudBackupEnabled !== false,
      remoteMonitoringEnabled: value.remoteMonitoringEnabled !== false,
    };
  } catch {
    return null;
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
  const db = await getOfflineDb();
  if (!db) return;
  await db.transaction("rw", db.meta, async () => {
    await setMeta(db, META_KEYS.licenseSnapshot, JSON.stringify(snapshot));
    await setMeta(db, META_KEYS.licenseActivated, "1");
  });
}

export async function loadOfflineLicenseState(now = Date.now()): Promise<OfflineLicenseState> {
  const db = await getOfflineDb();
  if (!db) {
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
  const state = resolveOfflineLicenseState({
    raw,
    activatedBefore: activated === "1",
    establishedOrganizationId: organizationId,
    now,
  });
  if (state.snapshot && activated !== "1") {
    await setMeta(db, META_KEYS.licenseActivated, "1");
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
