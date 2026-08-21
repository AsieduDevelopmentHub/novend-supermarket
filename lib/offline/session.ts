/**
 * Fast offline-session marker.
 * Written when a shell profile is saved; cleared on sign-out.
 * Lets the splash / auth gate proceed without waiting on Convex while offline.
 */

import { bindOfflineOrganization, unbindOfflineOrganization } from "./db";

const STORAGE_KEY = "princellen.offlineSession";

export type OfflineSessionHint = {
  userId: string;
  name: string;
  role: string;
  branchId: string;
  branchName: string;
  organizationId?: string;
  savedAt: number;
};

export function markOfflineSession(hint: OfflineSessionHint): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hint));
  } catch {
    // private mode / quota
  }
  if (hint.organizationId) {
    bindOfflineOrganization(hint.organizationId);
  }
}

export function clearOfflineSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  unbindOfflineOrganization();
}

export function readOfflineSession(): OfflineSessionHint | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
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
