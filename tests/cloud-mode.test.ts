import { describe, expect, it, vi } from "vitest";
import { resolveCloudPolicy } from "@/convex/shared/cloudMode";

// Deny-all policy for the drainOutbox gate test. Declared via the hoisted mock
// factory so the static `sync-engine` import below picks it up.
vi.mock("@/lib/offline/cloud-policy", () => ({
  loadCloudPolicy: async () => ({
    mode: "local_only" as const,
    shouldQueueRealtimeSync: () => false,
    shouldQueueBackup: () => false,
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
    expect(policy.shouldRunBackgroundSync()).toBe(true);
    expect(policy.shouldUseRealtimeSubscriptions()).toBe(true);
    expect(policy.shouldAllowRemoteMonitoring()).toBe(true);
  });

  it("backup_only keeps backups but stops realtime sync and subscriptions", () => {
    const policy = resolveCloudPolicy("backup_only");
    expect(policy.shouldQueueRealtimeSync()).toBe(false);
    expect(policy.shouldQueueBackup()).toBe(true);
    expect(policy.shouldRunBackgroundSync()).toBe(false);
    expect(policy.shouldUseRealtimeSubscriptions()).toBe(false);
  });

  it("local_only denies all sync and backup", () => {
    const policy = resolveCloudPolicy("local_only");
    expect(policy.shouldQueueRealtimeSync()).toBe(false);
    expect(policy.shouldQueueBackup()).toBe(false);
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

  it("backup entitlement off also disables backup_only backups", () => {
    const policy = resolveCloudPolicy("backup_only", { cloudBackupEnabled: false });
    expect(policy.shouldQueueBackup()).toBe(false);
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
