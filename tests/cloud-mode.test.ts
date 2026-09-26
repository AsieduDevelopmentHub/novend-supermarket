import { describe, expect, it, vi } from "vitest";
import {
  backupIntervalMs,
  normalizeBackupIntervalHours,
  resolveCloudPolicy,
  resolveEffectiveCloudMode,
  shouldApplyCloudSyncBoost,
  CLOUD_SYNC_BOOST_TTL_MS,
} from "@/convex/shared/cloudMode";
import { isScheduledBackupDue } from "@/lib/offline/scheduled-backup";

// Deny-all policy for the drainOutbox gate test. Declared via the hoisted mock
// factory so the static `sync-engine` import below picks it up.
vi.mock("@/lib/offline/cloud-policy", () => ({
  loadCloudPolicy: async () => ({
    mode: "local_only" as const,
    shouldQueueRealtimeSync: () => false,
    shouldQueueBackup: () => false,
    shouldQueueSnapshot: () => false,
    shouldRunBackgroundSync: () => false,
    shouldUseRealtimeSubscriptions: () => false,
    shouldAllowRemoteMonitoring: () => false,
    shouldAllowRemoteDeviceSync: () => false,
  }),
}));

import { drainOutbox } from "@/lib/offline/sync-engine";

describe("resolveCloudPolicy", () => {
  it("full_sync allows sync, backup, subscriptions, and monitoring", () => {
    const policy = resolveCloudPolicy("full_sync");
    expect(policy.mode).toBe("full_sync");
    expect(policy.shouldQueueRealtimeSync()).toBe(true);
    expect(policy.shouldQueueBackup()).toBe(true);
    expect(policy.shouldQueueSnapshot()).toBe(false);
    expect(policy.shouldRunBackgroundSync()).toBe(true);
    expect(policy.shouldUseRealtimeSubscriptions()).toBe(true);
    expect(policy.shouldAllowRemoteMonitoring()).toBe(true);
  });

  it("backup_only keeps backups but stops realtime sync and subscriptions", () => {
    const policy = resolveCloudPolicy("backup_only");
    expect(policy.shouldQueueRealtimeSync()).toBe(false);
    expect(policy.shouldQueueBackup()).toBe(true);
    expect(policy.shouldQueueSnapshot()).toBe(false);
    expect(policy.shouldRunBackgroundSync()).toBe(false);
    expect(policy.shouldUseRealtimeSubscriptions()).toBe(false);
  });

  it("snapshot_only queues compact snapshots without realtime sync", () => {
    const policy = resolveCloudPolicy("snapshot_only");
    expect(policy.shouldQueueRealtimeSync()).toBe(false);
    expect(policy.shouldQueueBackup()).toBe(false);
    expect(policy.shouldQueueSnapshot()).toBe(true);
    expect(policy.shouldUseRealtimeSubscriptions()).toBe(false);
  });

  it("local_only denies all sync and backup", () => {
    const policy = resolveCloudPolicy("local_only");
    expect(policy.shouldQueueRealtimeSync()).toBe(false);
    expect(policy.shouldQueueBackup()).toBe(false);
    expect(policy.shouldQueueSnapshot()).toBe(false);
    expect(policy.shouldRunBackgroundSync()).toBe(false);
    expect(policy.shouldUseRealtimeSubscriptions()).toBe(false);
    expect(policy.shouldAllowRemoteMonitoring()).toBe(false);
    expect(policy.shouldAllowRemoteDeviceSync()).toBe(false);
  });

  it("unknown / missing modes normalize to full_sync", () => {
    expect(resolveCloudPolicy(undefined).mode).toBe("full_sync");
    expect(resolveCloudPolicy("nonsense").mode).toBe("full_sync");
  });

  it("entitlement flags disable backup and monitoring even in full_sync", () => {
    const policy = resolveCloudPolicy("full_sync", {
      cloudBackupEnabled: false,
      remoteMonitoringEnabled: false,
    });
    expect(policy.shouldQueueRealtimeSync()).toBe(true);
    expect(policy.shouldQueueBackup()).toBe(false);
    expect(policy.shouldAllowRemoteMonitoring()).toBe(false);
  });

  it("backup entitlement off also disables backup_only and snapshot_only uploads", () => {
    expect(resolveCloudPolicy("backup_only", { cloudBackupEnabled: false }).shouldQueueBackup()).toBe(
      false,
    );
    expect(
      resolveCloudPolicy("snapshot_only", { cloudBackupEnabled: false }).shouldQueueSnapshot(),
    ).toBe(false);
  });
});

describe("backup interval", () => {
  const DAY = 24 * 60 * 60 * 1000;

  it("defaults unknown intervals to 24 hours", () => {
    expect(normalizeBackupIntervalHours(undefined)).toBe(24);
    expect(normalizeBackupIntervalHours(3)).toBe(24);
    expect(backupIntervalMs(undefined)).toBe(DAY);
  });

  it("keeps the Super Admin choices", () => {
    expect(normalizeBackupIntervalHours(168)).toBe(168);
    expect(backupIntervalMs(720)).toBe(30 * DAY);
  });

  it("treats a missing last backup as due, and respects the interval", () => {
    const now = Date.UTC(2026, 8, 25);
    expect(isScheduledBackupDue(0, now, 168)).toBe(true);
    expect(isScheduledBackupDue(now - DAY, now, 168)).toBe(false);
    expect(isScheduledBackupDue(now - 7 * DAY, now, 168)).toBe(true);
  });
});

describe("org sync boost", () => {
  it("resolves effective full_sync while boostUntil is in the future", () => {
    const now = 1_000_000;
    expect(
      resolveEffectiveCloudMode({
        planned: "snapshot_only",
        boostUntil: now + 60_000,
        now,
      }),
    ).toBe("full_sync");
    expect(
      resolveEffectiveCloudMode({
        planned: "local_only",
        boostUntil: now - 1,
        now,
      }),
    ).toBe("local_only");
  });

  it("does not boost full_sync orgs", () => {
    const now = 1_000_000;
    expect(shouldApplyCloudSyncBoost({ planned: "full_sync", now })).toEqual({
      apply: false,
      until: 0,
    });
  });

  it("starts a boost for package modes and extends when nearly expired", () => {
    const now = 1_000_000;
    const started = shouldApplyCloudSyncBoost({ planned: "backup_only", now });
    expect(started.apply).toBe(true);
    expect(started.until).toBe(now + CLOUD_SYNC_BOOST_TTL_MS);

    const stillFresh = shouldApplyCloudSyncBoost({
      planned: "backup_only",
      boostUntil: now + 45 * 60 * 1000,
      now,
    });
    expect(stillFresh.apply).toBe(false);
    expect(stillFresh.until).toBe(now + 45 * 60 * 1000);

    const nearlyDone = shouldApplyCloudSyncBoost({
      planned: "local_only",
      boostUntil: now + 10 * 60 * 1000,
      now,
    });
    expect(nearlyDone.apply).toBe(true);
    expect(nearlyDone.until).toBe(now + CLOUD_SYNC_BOOST_TTL_MS);
  });
});

// The heartbeat path (telemetry.recordHeartbeat) is intentionally NOT gated by
// the cloud policy: it must keep working in local_only so Novend can license and
// monitor the organization. Only business sync/backup are gated here.
describe("drainOutbox cloud policy gate", () => {
  it("skips draining when the policy denies realtime sync", async () => {
    const result = await drainOutbox({ mutators: {} as never, convex: {} as never });
    expect(result).toEqual({ processed: 0, failed: 0, skipped: true });
  }, 20000);
});
