/**
 * Cloud usage mode policy — shared by Convex and the browser client.
 *
 * A tenant's `organizations.cloudMode` decides how aggressively the device
 * talks to the cloud. Missing / unknown values normalize to `full_sync` so old
 * records and stale caches keep their current behaviour without a migration.
 * See docs/architecture/CLOUD_MODE_PLAN_V1.md and CLOUD_MODE_PLAN_V2.md.
 */

export const CLOUD_MODES = ["full_sync", "backup_only", "snapshot_only", "local_only"] as const;
export type CloudMode = (typeof CLOUD_MODES)[number];
export const DEFAULT_CLOUD_MODE: CloudMode = "full_sync";

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

/** How long an org-wide catch-up boost keeps every till on effective full_sync. */
export const CLOUD_SYNC_BOOST_TTL_MS = 2 * 60 * 60 * 1000;

/** Only extend an active boost when less than this remains. */
export const CLOUD_SYNC_BOOST_REFRESH_IF_REMAINING_MS = 30 * 60 * 1000;

/**
 * Planned PEAS mode vs temporary org-wide boost.
 * While `boostUntil` is in the future, every client treats the org as full_sync
 * for pull/outbox — without rewriting `organizations.cloudMode`.
 */
export function resolveEffectiveCloudMode(input: {
  planned: CloudMode | unknown;
  boostUntil?: number | null;
  now?: number;
}): CloudMode {
  const planned = normalizeCloudMode(input.planned);
  const now = input.now ?? Date.now();
  const until = input.boostUntil;
  if (typeof until === "number" && Number.isFinite(until) && until > now) {
    return "full_sync";
  }
  return planned;
}

/** Whether to start or extend an org sync boost given the planned mode and clock. */
export function shouldApplyCloudSyncBoost(input: {
  planned: CloudMode | unknown;
  boostUntil?: number | null;
  now?: number;
}): { apply: boolean; until: number } {
  const now = input.now ?? Date.now();
  const planned = normalizeCloudMode(input.planned);
  if (planned === "full_sync") {
    return { apply: false, until: 0 };
  }
  const existing = input.boostUntil;
  if (typeof existing === "number" && existing > now) {
    const remaining = existing - now;
    if (remaining >= CLOUD_SYNC_BOOST_REFRESH_IF_REMAINING_MS) {
      return { apply: false, until: existing };
    }
  }
  return { apply: true, until: now + CLOUD_SYNC_BOOST_TTL_MS };
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
