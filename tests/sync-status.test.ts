import { describe, expect, it } from "vitest";
import { describeSyncStatus } from "@/lib/offline/sync-status";

describe("describeSyncStatus", () => {
  it("keeps offline queued work calm (not conflict / not syncing)", () => {
    expect(
      describeSyncStatus({
        online: false,
        syncing: true,
        pendingCount: 2,
        failedCount: 1,
      }),
    ).toMatchObject({
      label: "Offline",
      detail: "2 saved on this device",
      kind: "offline",
    });
  });

  it("shows cloud disconnected when online without JWT", () => {
    expect(
      describeSyncStatus({
        online: true,
        syncing: false,
        pendingCount: 3,
        failedCount: 2,
        cloudConnected: false,
      }),
    ).toMatchObject({
      label: "Cloud disconnected",
      detail: "Sign in to upload",
      kind: "disconnected",
    });
  });

  it("stays calm while a fresh online login is still settling", () => {
    expect(
      describeSyncStatus({
        online: true,
        syncing: false,
        pendingCount: 0,
        failedCount: 0,
        cloudConnected: false,
        cloudSettling: true,
      }),
    ).toMatchObject({
      label: "Getting ready",
      detail: "Opening your workspace",
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

  it("surfaces failed rows that need attention only when cloud-connected", () => {
    expect(
      describeSyncStatus({
        online: true,
        syncing: false,
        pendingCount: 0,
        failedCount: 2,
        cloudConnected: true,
      }),
    ).toMatchObject({
      kind: "conflict",
    });
  });
});
