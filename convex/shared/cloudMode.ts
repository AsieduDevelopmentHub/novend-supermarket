/**
 * Cloud usage mode policy — shared by Convex and the browser client.
 *
 * A tenant's `organizations.cloudMode` decides how aggressively the device
 * talks to the cloud. Missing / unknown values normalize to `full_sync` so old
 * records and stale caches keep their current behaviour without a migration.
 * See docs/architecture/CLOUD_MODE_PLAN_V1.md and CLOUD_MODE_PLAN_V2.md.
 */

export const CLOUD_MODES = ["full_sync", "backup_only", "local_only"] as const;
export type CloudMode = (typeof CLOUD_MODES)[number];
export const DEFAULT_CLOUD_MODE: CloudMode = "full_sync";

export type CloudPolicy = {
  mode: CloudMode;
  shouldQueueRealtimeSync(): boolean;
  shouldQueueBackup(): boolean;
  shouldRunBackgroundSync(): boolean;
  shouldUseRealtimeSubscriptions(): boolean;
  shouldAllowRemoteMonitoring(): boolean;
  shouldAllowRemoteDeviceSync(): boolean;
};

export function normalizeCloudMode(value: unknown): CloudMode {
  if (value === "full_sync" || value === "backup_only" || value === "local_only") {
    return value;
  }
  return DEFAULT_CLOUD_MODE;
}

export function resolveCloudPolicy(mode: CloudMode | unknown): CloudPolicy {
  const normalized = normalizeCloudMode(mode);
  // Matrix from CLOUD_MODE_PLAN_V1:
  // full_sync: all yes
  // backup_only: no realtime flush/subs/remote device sync; backup yes; remote
  //   monitoring limited → false for allow flags that imply sync; background
  //   business sync no
  // local_only: only local; no backup scheduled; no remote
  switch (normalized) {
    case "backup_only":
      return {
        mode: normalized,
        shouldQueueRealtimeSync: () => false,
        shouldQueueBackup: () => true,
        shouldRunBackgroundSync: () => false,
        shouldUseRealtimeSubscriptions: () => false,
        shouldAllowRemoteMonitoring: () => false, // limited → deny for foundation
        shouldAllowRemoteDeviceSync: () => false,
      };
    case "local_only":
      return {
        mode: normalized,
        shouldQueueRealtimeSync: () => false,
        shouldQueueBackup: () => false,
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
        shouldQueueBackup: () => true,
        shouldRunBackgroundSync: () => true,
        shouldUseRealtimeSubscriptions: () => true,
        shouldAllowRemoteMonitoring: () => true,
        shouldAllowRemoteDeviceSync: () => true,
      };
  }
}
