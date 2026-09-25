export type SyncStatusInput = {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  failedCount: number;
  /**
   * Convex Auth JWT present. Offline shell with radio up is online but not
   * cloud-connected — never show conflict chrome in that state.
   */
  cloudConnected?: boolean;
};

export type SyncStatusKind = "offline" | "disconnected" | "queued" | "conflict" | "synced";

export type SyncStatusView = {
  label: string;
  detail: string;
  kind: SyncStatusKind;
};

/**
 * Shared copy for the header chip, sidebar chip, and banner.
 * Background drains are silent — never surface a global "Syncing…" state.
 * Offline / unauthenticated shells stay calm (no conflict chrome).
 */
export function describeSyncStatus(input: SyncStatusInput): SyncStatusView {
  const { online, pendingCount, failedCount, cloudConnected = true } = input;

  if (!online) {
    if (pendingCount > 0) {
      return {
        label: "Offline",
        detail: `${pendingCount} saved on this device`,
        kind: "offline",
      };
    }
    return { label: "Offline", detail: "On this device", kind: "offline" };
  }

  if (!cloudConnected) {
    if (pendingCount > 0 || failedCount > 0) {
      return {
        label: "Cloud disconnected",
        detail: "Sign in to upload",
        kind: "disconnected",
      };
    }
    return {
      label: "Cloud disconnected",
      detail: "Sign in to sync",
      kind: "disconnected",
    };
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
