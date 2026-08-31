import { describe, expect, it } from "vitest";
import { describeSyncStatus } from "@/lib/offline/sync-status";

describe("describeSyncStatus", () => {
  it("labels offline queued work as saved, not syncing", () => {
    expect(
      describeSyncStatus({
        online: false,
        syncing: true,
        pendingCount: 2,
        failedCount: 0,
      }),
    ).toMatchObject({
      label: "Saved offline",
      kind: "queued",
    });
  });

  it("shows queued while online until a drain is actually running", () => {
    expect(
      describeSyncStatus({
        online: true,
        syncing: false,
        pendingCount: 1,
        failedCount: 0,
      }),
    ).toMatchObject({
      label: "Queued for sync",
      kind: "queued",
    });
  });

  it("shows syncing only while online and draining", () => {
    expect(
      describeSyncStatus({
        online: true,
        syncing: true,
        pendingCount: 1,
        failedCount: 0,
      }),
    ).toMatchObject({
      label: "Syncing…",
      kind: "syncing",
    });
  });
});
