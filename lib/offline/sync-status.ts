export type SyncStatusInput = {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  failedCount: number;
};

export type SyncStatusKind = "offline" | "queued" | "syncing" | "conflict" | "synced";

export type SyncStatusView = {
  label: string;
  detail: string;
  kind: SyncStatusKind;
};

/**
 * Shared copy for the header chip, sidebar chip, and banner.
 * Entering the outbox is not "Syncing" — that label is only for an active drain
 * while the device is actually online.
 */
export function describeSyncStatus(input: SyncStatusInput): SyncStatusView {
  const { online, syncing, pendingCount, failedCount } = input;

  if (!online) {
    if (pendingCount > 0) {
      return {
        label: "Saved offline",
        detail: `${pendingCount} queued for sync`,
        kind: "queued",
      };
    }
    return { label: "Offline", detail: "On this device", kind: "offline" };
  }

  if (failedCount > 0) {
    return {
      label: `${failedCount} conflict${failedCount === 1 ? "" : "s"}`,
      detail: "Tap to review queue",
      kind: "conflict",
    };
  }

  if (syncing && pendingCount > 0) {
    return {
      label: "Syncing…",
      detail: `Uploading ${pendingCount} event${pendingCount === 1 ? "" : "s"}`,
      kind: "syncing",
    };
  }

  if (pendingCount > 0) {
    return {
      label: "Queued for sync",
      detail: `${pendingCount} waiting`,
      kind: "queued",
    };
  }

  return { label: "Synced", detail: "Up to date", kind: "synced" };
}
