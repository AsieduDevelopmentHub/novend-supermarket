import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";

type PendingClockIn = {
  userId: string;
  at: number;
};

/** Save the password-login instant so a later reconnect does not replace it. */
export async function rememberClockIn(userId: string, at = Date.now()) {
  if (!userId || !Number.isFinite(at)) return;
  const db = await getOfflineDb();
  if (!db) return;
  const payload: PendingClockIn = { userId, at };
  await setMeta(db, META_KEYS.pendingClockIn, JSON.stringify(payload));
}

export async function readPendingClockIn(userId: string): Promise<number | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const raw = await getMeta(db, META_KEYS.pendingClockIn);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingClockIn;
    if (parsed.userId !== userId || !Number.isFinite(parsed.at)) return null;
    return parsed.at;
  } catch {
    return null;
  }
}

export async function clearPendingClockIn(userId: string) {
  const db = await getOfflineDb();
  if (!db) return;
  const pending = await readPendingClockIn(userId);
  if (pending == null) return;
  await db.meta.delete(META_KEYS.pendingClockIn);
}