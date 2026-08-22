/**
 * Fast offline-session marker.
 * Written when a shell profile is saved; cleared on sign-out.
 * Lets the splash / auth gate proceed without waiting on Convex while offline.
 */

import { bindOfflineOrganization, unbindOfflineOrganization } from "./db";

const STORAGE_KEY = "novend.offlineSession";
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

function readStoredSessionRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
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

export function markOfflineSession(hint: OfflineSessionHint): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hint));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // private mode / quota
  }
  if (hint.organizationId) {
    bindOfflineOrganization(hint.organizationId, hint.userId);
  }
}

export function clearOfflineSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
  unbindOfflineOrganization();
}

export function readOfflineSession(): OfflineSessionHint | null {
  try {
    const raw = readStoredSessionRaw();
    if (!raw) return null;
    migrateLegacySession(raw);
    const parsed = JSON.parse(raw) as OfflineSessionHint;
    if (!parsed?.userId || !parsed?.role || !parsed?.branchId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** True when this device has previously completed an authenticated shell boot. */
export function hasOfflineSession(): boolean {
  return readOfflineSession() != null;
}
