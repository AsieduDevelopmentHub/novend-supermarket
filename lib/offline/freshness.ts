/**
 * Offline mirror freshness helpers.
 * List UIs and snapshot pulls use these TTLs to avoid redundant Convex traffic.
 */
import { getMeta, getOfflineDb, META_KEYS } from "./db";

/** How long a Dexie snapshot is considered warm enough to skip live list subscriptions. */
export const MIRROR_LIST_TTL_MS = 5 * 60 * 1000;

/** Minimum gap between background catalog snapshot pulls (unless forced). */
export const SNAPSHOT_PULL_TTL_MS = 2 * 60 * 1000;

/** How often the outbox drain timer runs while online. */
export const OUTBOX_POLL_MS = 45_000;

export async function getLastSnapshotAt(): Promise<number | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const raw = await getMeta(db, META_KEYS.lastSnapshotAt);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function isMirrorFresh(ttlMs = MIRROR_LIST_TTL_MS): Promise<boolean> {
  const at = await getLastSnapshotAt();
  if (!at) return false;
  return Date.now() - at < ttlMs;
}

export async function mirrorHasCatalog(): Promise<boolean> {
  const db = await getOfflineDb();
  if (!db) return false;
  const count = await db.products.limit(1).count();
  return count > 0;
}

/** True when Dexie has catalog rows and the last snapshot is within TTL. */
export async function canServeListsFromMirror(): Promise<boolean> {
  const [hasCatalog, fresh] = await Promise.all([mirrorHasCatalog(), isMirrorFresh()]);
  return hasCatalog && fresh;
}
