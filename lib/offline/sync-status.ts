export type SyncStatusInput = {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  failedCount: number;
};

export type SyncStatusKind = "offline" | "queued" | "conflict" | "synced";

export type SyncStatusView = {
  label: string;
  detail: string;
  kind: SyncStatusKind;
};

/**
 * Shared copy for the header chip, sidebar chip, and banner.
 * Background drains are silent — never surface a global "Syncing…" state.
 */
export function describeSyncStatus(input: SyncStatusInput): SyncStatusView {
  const { online, pendingCount, failedCount } = input;

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
      label: `${failedCount} need${failedCount === 1 ? "s" : ""} attention`,
      detail: "Open sync center to review",
      kind: "conflict",
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
