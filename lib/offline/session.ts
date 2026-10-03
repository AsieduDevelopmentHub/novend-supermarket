/**
 * Offline session registry for shared tills.
 *
 * Every staff account that successfully signs in on this device is remembered
 * so poor-network locations can resume *any* of those shells — not only the
 * latest login. The active hint drives the current Dexie binding; the registry
 * keeps the rest available from the login screen.
 */

import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import { readPlatformOfflineSession } from "@/lib/offline/platform-cache";
import { bindOfflineOrganization, unbindOfflineOrganization } from "./db";
import {
  clearDeviceOfflineSessions,
  deleteDeviceOfflineSession,
  listDeviceOfflineSessions,
  readDeviceOfflineSession,
  saveDeviceOfflineSession,
} from "./device-auth-store";

const ACTIVE_KEY = "novend.offlineSession";
const REGISTRY_KEY = "novend.offlineSessions";
/** Pre-rebrand localStorage key — read-only migration from early Novend builds. */
const LEGACY_ACTIVE_KEY = "princellen.offlineSession";
const OFFLINE_AUTHORITY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type OfflineSessionHint = {
  userId: string;
  name: string;
  role: string;
  branchId: string;
  branchName: string;
  organizationId?: string;
  /** Optional sign-in email for the offline account picker. */
  email?: string;
  /** Last online authority refresh; offline activation must never renew this. */
  savedAt: number;
};

/** Same-tab listeners (useSyncExternalStore) — `storage` only fires across tabs. */
export const OFFLINE_SESSION_EVENT = "novend-offline-session";

let snapshotRaw: string | null | undefined;
let snapshotHint: OfflineSessionHint | null = null;
let registrySnapshotRaw: string | null | undefined;
let registrySnapshot: OfflineSessionHint[] = [];

function notifyOfflineSession(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OFFLINE_SESSION_EVENT));
}

function readActiveRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_KEY) ?? window.localStorage.getItem(LEGACY_ACTIVE_KEY);
  } catch {
    return null;
  }
}

function readRegistryRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(REGISTRY_KEY);
  } catch {
    return null;
  }
}

function migrateLegacyActive(raw: string): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(ACTIVE_KEY)) return;
    window.localStorage.setItem(ACTIVE_KEY, raw);
    window.localStorage.removeItem(LEGACY_ACTIVE_KEY);
  } catch {
    // private mode / quota
  }
}

function isFreshHint(parsed: OfflineSessionHint | null): parsed is OfflineSessionHint {
  if (!parsed?.userId || !parsed?.role || !parsed?.branchId) return false;
  if (!Number.isFinite(parsed.savedAt) || Date.now() - parsed.savedAt > OFFLINE_AUTHORITY_TTL_MS) {
    return false;
  }
  return true;
}

function parseHint(raw: string | null): OfflineSessionHint | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OfflineSessionHint;
    return isFreshHint(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseRegistry(raw: string | null): OfflineSessionHint[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        return isFreshHint(row as OfflineSessionHint) ? (row as OfflineSessionHint) : null;
      })
      .filter((row): row is OfflineSessionHint => row !== null)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

function rememberActiveSnapshot(raw: string | null, hint: OfflineSessionHint | null): void {
  snapshotRaw = raw;
  snapshotHint = hint;
}

function rememberRegistrySnapshot(raw: string | null, rows: OfflineSessionHint[]): void {
  registrySnapshotRaw = raw;
  registrySnapshot = rows;
}

function writeRegistry(rows: OfflineSessionHint[]): void {
  const fresh = rows.filter(isFreshHint).sort((a, b) => b.savedAt - a.savedAt);
  let raw: string | null = null;
  try {
    raw = JSON.stringify(fresh);
    window.localStorage.setItem(REGISTRY_KEY, raw);
  } catch {
    /* private mode / quota */
  }
  rememberRegistrySnapshot(raw, fresh);
}

function upsertRegistry(hint: OfflineSessionHint): OfflineSessionHint[] {
  const current = listOfflineSessions().filter((row) => row.userId !== hint.userId);
  current.push(hint);
  writeRegistry(current);
  return listOfflineSessions();
}

/**
 * Stable snapshot for `useSyncExternalStore`. Must return the same object
 * reference when storage has not changed — a fresh `JSON.parse` every call
 * infinite-loops React ("Maximum update depth exceeded").
 */
export function getOfflineSessionSnapshot(): OfflineSessionHint | null {
  const raw = readActiveRaw();
  if (raw === snapshotRaw && (!snapshotHint || isFreshHint(snapshotHint))) return snapshotHint;
  const hint = parseHint(raw);
  rememberActiveSnapshot(raw, hint);
  return hint;
}

/** All fresh offline shells remembered on this device (newest first). */
export function listOfflineSessions(): OfflineSessionHint[] {
  const raw = readRegistryRaw();
  if (raw === registrySnapshotRaw && registrySnapshot.every(isFreshHint)) return registrySnapshot;
  let rows = parseRegistry(raw);

  // Migrate: single active hint from older builds becomes the registry seed.
  const active = getOfflineSessionSnapshot();
  if (active && !rows.some((row) => row.userId === active.userId)) {
    rows = [active, ...rows];
    writeRegistry(rows);
    return listOfflineSessions();
  }

  rememberRegistrySnapshot(raw, rows);
  return rows;
}

export function markOfflineSession(hint: OfflineSessionHint): void {
  let raw: string | null = null;
  try {
    raw = JSON.stringify(hint);
    window.localStorage.setItem(ACTIVE_KEY, raw);
    window.localStorage.removeItem(LEGACY_ACTIVE_KEY);
  } catch {
    /* private mode / quota */
  }
  rememberActiveSnapshot(raw, hint);
  upsertRegistry(hint);
  void saveDeviceOfflineSession(hint);
  if (hint.organizationId) {
    bindOfflineOrganization(hint.organizationId, hint.userId);
  }
  notifyOfflineSession();
}

/**
 * Make a previously remembered account the active offline shell and bind its
 * Dexie replica. Used by the login-screen account picker when offline.
 */
export function activateOfflineSession(userId: string): OfflineSessionHint | null {
  const hint = listOfflineSessions().find((row) => row.userId === userId) ?? null;
  if (!hint) return null;
  markOfflineSession(hint);
  return hint;
}

/** Restore a remembered account even when localStorage was evicted or corrupted. */
export async function activateOfflineSessionWithFallback(
  userId: string,
): Promise<OfflineSessionHint | null> {
  const local = activateOfflineSession(userId);
  if (local) return local;
  const durable = await readDeviceOfflineSession(userId);
  if (!isFreshHint(durable)) return null;
  markOfflineSession(durable);
  return durable;
}

/**
 * Rebuild fast boot hints from the device IndexedDB before opening an org replica.
 * After an explicit sign-out, only refresh the account registry — never re-mark
 * the active shell (that would skip login and trap the splash).
 */
export async function hydrateOfflineSessionsFromDeviceStore(): Promise<OfflineSessionHint | null> {
  const durable = (await listDeviceOfflineSessions()).filter(isFreshHint);
  const local = listOfflineSessions();
  const merged = new Map<string, OfflineSessionHint>();
  for (const row of [...durable, ...local]) {
    const current = merged.get(row.userId);
    if (!current || row.savedAt > current.savedAt) merged.set(row.userId, row);
  }
  const rows = [...merged.values()].sort((a, b) => b.savedAt - a.savedAt);
  if (rows.length > 0) writeRegistry(rows);
  const active = getOfflineSessionSnapshot();
  if (active) return active;
  if (hasExplicitLogout()) return null;
  // A live platform Super Admin session must not resurrect a tenant cashier.
  if (readPlatformOfflineSession()) return null;
  const first = rows[0];
  if (!first) return null;
  markOfflineSession(first);
  return first;
}

/**
 * If the active hint was cleared (or TTL-expired) but the registry still has
 * accounts, re-activate the newest one so Cap/Electron reconnect keeps the POS
 * shell instead of bouncing to `/login`.
 */
export function ensureActiveOfflineSession(): OfflineSessionHint | null {
  const active = getOfflineSessionSnapshot();
  if (active) return active;
  if (hasExplicitLogout()) return null;
  if (readPlatformOfflineSession()) return null;
  const first = listOfflineSessions()[0];
  if (!first) return null;
  return activateOfflineSession(first.userId);
}

/** Drop one remembered account (and stop auto-resuming it). Does not wipe Dexie. */
export function forgetOfflineSession(userId: string): void {
  const remaining = listOfflineSessions().filter((row) => row.userId !== userId);
  writeRegistry(remaining);
  const active = getOfflineSessionSnapshot();
  if (active?.userId === userId) {
    try {
      window.localStorage.removeItem(ACTIVE_KEY);
      window.localStorage.removeItem(LEGACY_ACTIVE_KEY);
    } catch {
      /* ignore */
    }
    rememberActiveSnapshot(null, null);
    unbindOfflineOrganization();
  }
  void deleteDeviceOfflineSession(userId);
  notifyOfflineSession();
}

/**
 * End the *active* offline shell marker after sign-out.
 * Other remembered accounts stay available for offline resume on this device.
 */
export function clearOfflineSession(): void {
  try {
    window.localStorage.removeItem(ACTIVE_KEY);
    window.localStorage.removeItem(LEGACY_ACTIVE_KEY);
  } catch {
    /* ignore */
  }
  rememberActiveSnapshot(null, null);
  unbindOfflineOrganization();
  notifyOfflineSession();
}

/** Wipe every remembered offline account (privacy / factory reset paths). */
export function clearAllOfflineSessions(): void {
  try {
    window.localStorage.removeItem(ACTIVE_KEY);
    window.localStorage.removeItem(LEGACY_ACTIVE_KEY);
    window.localStorage.removeItem(REGISTRY_KEY);
  } catch {
    /* ignore */
  }
  rememberActiveSnapshot(null, null);
  rememberRegistrySnapshot(null, []);
  void clearDeviceOfflineSessions();
  unbindOfflineOrganization();
  notifyOfflineSession();
}

export function readOfflineSession(): OfflineSessionHint | null {
  const raw = readActiveRaw();
  if (raw && typeof window !== "undefined") {
    try {
      if (
        !window.localStorage.getItem(ACTIVE_KEY) &&
        window.localStorage.getItem(LEGACY_ACTIVE_KEY)
      ) {
        migrateLegacyActive(raw);
      }
    } catch {
      /* private mode */
    }
  }
  // Ensure registry migration runs when callers only read the active hint.
  void listOfflineSessions();
  return getOfflineSessionSnapshot();
}

/** True when this device has at least one remembered offline shell. */
export function hasOfflineSession(): boolean {
  return listOfflineSessions().length > 0 || getOfflineSessionSnapshot() != null;
}
