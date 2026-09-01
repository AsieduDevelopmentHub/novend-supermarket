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

  it("shows queued while online with pending work", () => {
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

  it("keeps background drains silent even when syncing flag is set", () => {
    expect(
      describeSyncStatus({
        online: true,
        syncing: true,
        pendingCount: 1,
        failedCount: 0,
      }),
    ).toMatchObject({
      label: "Queued for sync",
      kind: "queued",
    });
  });

  it("surfaces failed rows that need attention", () => {
    expect(
      describeSyncStatus({
        online: true,
        syncing: false,
        pendingCount: 0,
        failedCount: 2,
      }),
    ).toMatchObject({
      kind: "conflict",
    });
  });
});
