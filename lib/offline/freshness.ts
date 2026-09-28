/**
 * Offline mirror freshness helpers.
 * List UIs and snapshot pulls use these TTLs to avoid redundant Convex traffic.
 *
 * Design rule: once Dexie has catalog rows, business list UIs must **not** open
 * live Convex subscriptions (`listProducts` / inventory / customers still
 * `.collect()` the org and dominate database bandwidth). Background snapshot
 * pull is the only bulk refresh path.
 */
import { getMeta, getOfflineDb, META_KEYS } from "./db";
import { loadCloudPolicy } from "./cloud-policy";

/** Legacy “warm window” for callers that still check TTL (not used to open live lists). */
export const MIRROR_LIST_TTL_MS = 5 * 60 * 1000;

/**
 * Minimum gap between background catalog snapshot pulls (unless forced).
 * Keep aligned with AUTO_SYNC — a 2-minute pull was burning Convex I/O on every till.
 */
export const SNAPSHOT_PULL_TTL_MS = 20 * 60 * 1000;

/**
 * Background auto-sync cadence while online.
 * Snapshot + outbox run at least this often when connected.
 */
export const AUTO_SYNC_INTERVAL_MS = 20 * 60 * 1000;

/**
 * Drain the outbox as soon as this many pending/syncing events accumulate,
 * without waiting for the full auto-sync interval.
 */
export const AUTO_SYNC_PENDING_THRESHOLD = 10;

/** How often we check pending count / decide whether to sync (desktop + web). */
export const OUTBOX_POLL_MS = 15_000;

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

/**
 * Whether business lists (inventory, products, customers, …) may open live Convex.
 *
 * Prefer Dexie whenever the mirror already has catalog rows (stale-while-revalidate).
 * Live list queries `.collect()` the full org — never open them just because the
 * snapshot TTL expired; background `pullSnapshot` refreshes Dexie instead.
 */
export async function shouldUseRemoteBusinessLists(online: boolean): Promise<boolean> {
  if (!online) return false;
  const policy = await loadCloudPolicy();
  if (!policy.shouldUseRealtimeSubscriptions()) return false;
  // Cold till only: no mirrored products yet → one live subscription bootstraps UI
  // until the first snapshot lands. After that, always Dexie.
  if (await mirrorHasCatalog()) return false;
  return true;
}

/**
 * Whether Sales may open a live Convex catalog subscription.
 * Package modes (`backup_only` / `snapshot_only`) never mirror products into Dexie
 * via realtime sync — remote rows let staff build a cart that then fails at
 * `completeSaleLocally` with "Product unavailable".
 */
export async function shouldUseRemoteSalesCatalog(online: boolean): Promise<boolean> {
  return shouldUseRemoteBusinessLists(online);
}
