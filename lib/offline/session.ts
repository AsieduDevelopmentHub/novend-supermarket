/**
 * Fast offline-session marker.
 * Written when a shell profile is saved; cleared on sign-out.
 * Lets the splash / auth gate proceed without waiting on Convex while offline.
 */

import { bindOfflineOrganization, unbindOfflineOrganization } from "./db";

const STORAGE_KEY = "novend.offlineSession";
const OFFLINE_AUTHORITY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Pre-rebrand localStorage key — read-only migration from early Novend builds. */
const LEGACY_STORAGE_KEY = "princellen.offlineSession";

export type OfflineSessionHint = {
  userId: string;
  name: string;
  role: string;
  branchId: string;
  branchName: string;
  organizationId?: string;
  savedAt: number;
};

/** Same-tab listeners (useSyncExternalStore) — `storage` only fires across tabs. */
export const OFFLINE_SESSION_EVENT = "novend-offline-session";

let snapshotRaw: string | null | undefined;
let snapshotHint: OfflineSessionHint | null = null;

function notifyOfflineSession(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OFFLINE_SESSION_EVENT));
}

function readStoredSessionRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

function migrateLegacySession(raw: string): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    window.localStorage.setItem(STORAGE_KEY, raw);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // private mode / quota
  }
}

function parseHint(raw: string | null): OfflineSessionHint | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OfflineSessionHint;
    if (!parsed?.userId || !parsed?.role || !parsed?.branchId) return null;
    if (
      !Number.isFinite(parsed.savedAt) ||
      Date.now() - parsed.savedAt > OFFLINE_AUTHORITY_TTL_MS
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function rememberSnapshot(raw: string | null, hint: OfflineSessionHint | null): void {
  snapshotRaw = raw;
  snapshotHint = hint;
}

/**
 * Stable snapshot for `useSyncExternalStore`. Must return the same object
 * reference when storage has not changed — a fresh `JSON.parse` every call
 * infinite-loops React ("Maximum update depth exceeded").
 */
export function getOfflineSessionSnapshot(): OfflineSessionHint | null {
  const raw = readStoredSessionRaw();
  if (raw === snapshotRaw) return snapshotHint;
  const hint = parseHint(raw);
  rememberSnapshot(raw, hint);
  return hint;
}

export function markOfflineSession(hint: OfflineSessionHint): void {
  let raw: string | null = null;
  try {
    raw = JSON.stringify(hint);
    window.localStorage.setItem(STORAGE_KEY, raw);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* private mode / quota */
  }
  rememberSnapshot(raw, hint);
  if (hint.organizationId) {
    bindOfflineOrganization(hint.organizationId, hint.userId);
  }
  notifyOfflineSession();
}

export function clearOfflineSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  rememberSnapshot(null, null);
  unbindOfflineOrganization();
  notifyOfflineSession();
}

export function readOfflineSession(): OfflineSessionHint | null {
  const raw = readStoredSessionRaw();
  if (raw && typeof window !== "undefined") {
    try {
      if (
        !window.localStorage.getItem(STORAGE_KEY) &&
        window.localStorage.getItem(LEGACY_STORAGE_KEY)
      ) {
        migrateLegacySession(raw);
      }
    } catch {
      /* private mode */
    }
  }
  return getOfflineSessionSnapshot();
}

/** True when this device has previously completed an authenticated shell boot. */
export function hasOfflineSession(): boolean {
  return getOfflineSessionSnapshot() != null;
}
