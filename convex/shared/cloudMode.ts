/**
 * Cloud usage mode policy — shared by Convex and the browser client.
 *
 * A tenant's `organizations.cloudMode` decides how aggressively the device
 * talks to the cloud. Milliesmart is local-only: missing / unknown values
 * normalize to `local_only`. See docs/architecture/OFFLINE_SYNC.md.
 */

export const CLOUD_MODES = ["full_sync", "backup_only", "snapshot_only", "local_only"] as const;
export type CloudMode = (typeof CLOUD_MODES)[number];
export const DEFAULT_CLOUD_MODE: CloudMode = "local_only";

/**
 * How often a backup_only / snapshot_only device may upload an automatic package.
 * Missing / unknown values stay at 24 hours so existing orgs keep today's cadence.
 * Longer values are the Super Admin lever for cutting Convex storage and calls.
 */
export const BACKUP_INTERVAL_HOURS = [12, 24, 48, 168, 336, 720] as const;
export type BackupIntervalHours = (typeof BACKUP_INTERVAL_HOURS)[number];
export const DEFAULT_BACKUP_INTERVAL_HOURS: BackupIntervalHours = 24;

export function normalizeBackupIntervalHours(value: unknown): BackupIntervalHours {
  if (typeof value === "number" && (BACKUP_INTERVAL_HOURS as readonly number[]).includes(value)) {
    return value as BackupIntervalHours;
  }
  return DEFAULT_BACKUP_INTERVAL_HOURS;
}

export function backupIntervalMs(hours: unknown): number {
  return normalizeBackupIntervalHours(hours) * 60 * 60 * 1000;
}

export type CloudPolicy = {
  mode: CloudMode;
  shouldQueueRealtimeSync(): boolean;
  /** Full Dexie dump upload (backup_only / entitled full_sync). */
  shouldQueueBackup(): boolean;
  /** Compact business snapshot upload (snapshot_only). */
  shouldQueueSnapshot(): boolean;
  shouldRunBackgroundSync(): boolean;
  shouldUseRealtimeSubscriptions(): boolean;
  shouldAllowRemoteMonitoring(): boolean;
  shouldAllowRemoteDeviceSync(): boolean;
};

export function normalizeCloudMode(value: unknown): CloudMode {
  if (
    value === "full_sync" ||
    value === "backup_only" ||
    value === "snapshot_only" ||
    value === "local_only"
  ) {
    return value;
  }
  return DEFAULT_CLOUD_MODE;
}

/**
 * Platform-owned entitlement flags layered on top of the cloud mode. Both
 * default to enabled when missing, matching pre-entitlement behaviour. Cloud
 * backup and remote monitoring can each be switched off for an organization by
 * a Super Admin regardless of the selected cloud mode.
 */
export type CloudEntitlements = {
  cloudBackupEnabled?: boolean;
  remoteMonitoringEnabled?: boolean;
};

/**
 * Allowed catch-up boost durations (minutes). Platform admins pick from this
 * list for the deployment default and per-org overrides.
 */
export const CLOUD_SYNC_BOOST_TTL_MINUTES = [15, 30, 45, 60, 90, 120] as const;
export type CloudSyncBoostTtlMinutes = (typeof CLOUD_SYNC_BOOST_TTL_MINUTES)[number];
export const DEFAULT_CLOUD_SYNC_BOOST_TTL_MINUTES: CloudSyncBoostTtlMinutes = 30;

/** Default TTL in ms when neither org nor platform default is set. */
export const CLOUD_SYNC_BOOST_TTL_MS = DEFAULT_CLOUD_SYNC_BOOST_TTL_MINUTES * 60 * 1000;

/** @deprecated Prefer `cloudSyncBoostRefreshIfRemainingMs(ttlMs)`. Kept for callers on the default TTL. */
export const CLOUD_SYNC_BOOST_REFRESH_IF_REMAINING_MS = Math.floor(CLOUD_SYNC_BOOST_TTL_MS / 3);

export function normalizeCloudSyncBoostTtlMinutes(value: unknown): CloudSyncBoostTtlMinutes {
  if (
    typeof value === "number" &&
    (CLOUD_SYNC_BOOST_TTL_MINUTES as readonly number[]).includes(value)
  ) {
    return value as CloudSyncBoostTtlMinutes;
  }
  return DEFAULT_CLOUD_SYNC_BOOST_TTL_MINUTES;
}

/** Org override → platform default → hard-coded 30 minutes. */
export function resolveCloudSyncBoostTtlMinutes(input: {
  organizationMinutes?: number | null;
  globalMinutes?: number | null;
}): CloudSyncBoostTtlMinutes {
  if (
    typeof input.organizationMinutes === "number" &&
    (CLOUD_SYNC_BOOST_TTL_MINUTES as readonly number[]).includes(input.organizationMinutes)
  ) {
    return input.organizationMinutes as CloudSyncBoostTtlMinutes;
  }
  if (
    typeof input.globalMinutes === "number" &&
    (CLOUD_SYNC_BOOST_TTL_MINUTES as readonly number[]).includes(input.globalMinutes)
  ) {
    return input.globalMinutes as CloudSyncBoostTtlMinutes;
  }
  return DEFAULT_CLOUD_SYNC_BOOST_TTL_MINUTES;
}

export function cloudSyncBoostTtlMs(minutes: unknown): number {
  return normalizeCloudSyncBoostTtlMinutes(minutes) * 60 * 1000;
}

/** Refresh only when less than one-third of the configured TTL remains. */
export function cloudSyncBoostRefreshIfRemainingMs(ttlMs: number): number {
  const safe = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : CLOUD_SYNC_BOOST_TTL_MS;
  return Math.floor(safe / 3);
}

/**
 * Milliesmart never boosts into full_sync — business data stays on the till.
 */
export function resolveEffectiveCloudMode(input: {
  planned: CloudMode | unknown;
  boostUntil?: number | null;
  now?: number;
}): CloudMode {
  return normalizeCloudMode(input.planned);
}

/** Sync boost is disabled for this single-store offline product. */
export function shouldApplyCloudSyncBoost(_input: {
  planned: CloudMode | unknown;
  boostUntil?: number | null;
  now?: number;
  /** Effective TTL for this org (resolved from org → global → default). */
  ttlMs?: number;
}): { apply: boolean; until: number } {
  return { apply: false, until: 0 };
}

export function resolveCloudPolicy(
  mode: CloudMode | unknown,
  entitlements?: CloudEntitlements,
): CloudPolicy {
  const normalized = normalizeCloudMode(mode);
  const backupEntitled = entitlements?.cloudBackupEnabled !== false;
  const monitoringEntitled = entitlements?.remoteMonitoringEnabled !== false;
  switch (normalized) {
    case "backup_only":
      return {
        mode: normalized,
        shouldQueueRealtimeSync: () => false,
        shouldQueueBackup: () => backupEntitled,
        shouldQueueSnapshot: () => false,
        shouldRunBackgroundSync: () => false,
        shouldUseRealtimeSubscriptions: () => false,
        shouldAllowRemoteMonitoring: () => false,
        shouldAllowRemoteDeviceSync: () => false,
      };
    case "snapshot_only":
      return {
        mode: normalized,
        shouldQueueRealtimeSync: () => false,
        shouldQueueBackup: () => false,
        shouldQueueSnapshot: () => backupEntitled,
        shouldRunBackgroundSync: () => false,
        shouldUseRealtimeSubscriptions: () => false,
        shouldAllowRemoteMonitoring: () => false,
        shouldAllowRemoteDeviceSync: () => false,
      };
    case "local_only":
      return {
        mode: normalized,
        shouldQueueRealtimeSync: () => false,
        shouldQueueBackup: () => false,
        shouldQueueSnapshot: () => false,
        shouldRunBackgroundSync: () => false,
        shouldUseRealtimeSubscriptions: () => false,
        shouldAllowRemoteMonitoring: () => false,
        shouldAllowRemoteDeviceSync: () => false,
      };
    case "full_sync":
    default:
      return {
        mode: "full_sync",
        shouldQueueRealtimeSync: () => true,
        shouldQueueBackup: () => backupEntitled,
        shouldQueueSnapshot: () => false,
        shouldRunBackgroundSync: () => true,
        shouldUseRealtimeSubscriptions: () => true,
        shouldAllowRemoteMonitoring: () => monitoringEntitled,
        shouldAllowRemoteDeviceSync: () => true,
      };
  }
}
