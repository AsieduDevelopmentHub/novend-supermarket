import { newClientId, type NovendOfflineDb } from "./db";

export const SYNC_LEASE_MS = 2 * 60 * 1000;
const RENEW_INTERVAL_MS = 15_000;
const LEASE_KEY = "outboxSyncLease";
type Lease = { owner: string; expiresAt: number };

function readLease(value?: string): Lease | null {
  try {
    const lease = JSON.parse(value ?? "null") as Lease | null;
    return lease && typeof lease.owner === "string" && Number.isFinite(lease.expiresAt)
      ? lease
      : null;
  } catch {
    return null;
  }
}

/** One drainer per org replica, including older WebViews without Web Locks. */
export async function withOutboxSyncLock<T>(
  db: NovendOfflineDb,
  work: (ownsLease: () => Promise<boolean>, owner: string) => Promise<T>,
): Promise<T | null> {
  const owner = globalThis.crypto?.randomUUID?.() ?? newClientId("sync");
  const acquired = await db.transaction("rw", db.meta, async () => {
    const lease = readLease((await db.meta.get(LEASE_KEY))?.value);
    if (lease && lease.expiresAt > Date.now()) return false;
    await db.meta.put({
      key: LEASE_KEY,
      value: JSON.stringify({ owner, expiresAt: Date.now() + SYNC_LEASE_MS }),
    });
    return true;
  });
  if (!acquired) return null;

  let lost = false;
  const ownsLease = async () => {
    const lease = readLease((await db.meta.get(LEASE_KEY))?.value);
    return !lost && lease?.owner === owner && lease.expiresAt > Date.now();
  };
  const renew = async () => {
    await db.transaction("rw", [db.meta, db.outbox], async () => {
      const lease = readLease((await db.meta.get(LEASE_KEY))?.value);
      if (lease?.owner !== owner || lease.expiresAt <= Date.now()) {
        lost = true;
        return;
      }
      const now = Date.now();
      await db.meta.put({
        key: LEASE_KEY,
        value: JSON.stringify({ owner, expiresAt: now + SYNC_LEASE_MS }),
      });
      // Keep live claims distinguishable from a crashed worker's claims.
      await db.outbox
        .where("status")
        .equals("syncing")
        .filter((row) => row.syncOwner === owner)
        .modify({ updatedAt: now });
    });
  };
  const timer = setInterval(
    () =>
      void renew().catch(() => {
        lost = true;
      }),
    RENEW_INTERVAL_MS,
  );
  try {
    return await work(ownsLease, owner);
  } finally {
    clearInterval(timer);
    await db.transaction("rw", db.meta, async () => {
      if (readLease((await db.meta.get(LEASE_KEY))?.value)?.owner === owner) {
        await db.meta.delete(LEASE_KEY);
      }
    });
  }
}
