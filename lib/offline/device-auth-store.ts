import Dexie, { type EntityTable } from "dexie";

export type DurableOfflineSession = {
  userId: string;
  name: string;
  role: string;
  branchId: string;
  branchName: string;
  organizationId?: string;
  email?: string;
  savedAt: number;
};

export type DurableLocalAuthVerifier = {
  email: string;
  v: 1;
  userId: string;
  salt: string;
  hash: string;
  iterations: number;
};

type DeviceAuthDb = Dexie & {
  sessions: EntityTable<DurableOfflineSession, "userId">;
  verifiers: EntityTable<DurableLocalAuthVerifier, "email">;
};

let deviceDb: DeviceAuthDb | null = null;
let deviceDbUnavailable = false;

function getDeviceAuthDb(): DeviceAuthDb | null {
  if (deviceDbUnavailable || typeof indexedDB === "undefined") return null;
  if (deviceDb) return deviceDb;
  try {
    const db = new Dexie("novend-device-auth-v1") as DeviceAuthDb;
    db.version(1).stores({
      sessions: "userId, email, organizationId, savedAt",
      verifiers: "email, userId",
    });
    deviceDb = db;
    return db;
  } catch {
    deviceDbUnavailable = true;
    return null;
  }
}

export async function saveDeviceOfflineSession(
  session: DurableOfflineSession,
): Promise<boolean> {
  const db = getDeviceAuthDb();
  if (!db) return false;
  try {
    await db.sessions.put(session);
    return true;
  } catch {
    return false;
  }
}

export async function readDeviceOfflineSession(
  userId: string,
): Promise<DurableOfflineSession | null> {
  const db = getDeviceAuthDb();
  if (!db) return null;
  try {
    return (await db.sessions.get(userId)) ?? null;
  } catch {
    return null;
  }
}

export async function listDeviceOfflineSessions(): Promise<DurableOfflineSession[]> {
  const db = getDeviceAuthDb();
  if (!db) return [];
  try {
    return await db.sessions.orderBy("savedAt").reverse().toArray();
  } catch {
    return [];
  }
}

export async function deleteDeviceOfflineSession(userId: string): Promise<void> {
  const db = getDeviceAuthDb();
  if (!db) return;
  try {
    await db.sessions.delete(userId);
  } catch {
    /* already unavailable */
  }
}

export async function clearDeviceOfflineSessions(): Promise<void> {
  const db = getDeviceAuthDb();
  if (!db) return;
  try {
    await db.sessions.clear();
  } catch {
    /* already unavailable */
  }
}

export async function saveDeviceAuthVerifier(
  verifier: DurableLocalAuthVerifier,
): Promise<boolean> {
  const db = getDeviceAuthDb();
  if (!db) return false;
  try {
    await db.verifiers.put(verifier);
    return true;
  } catch {
    return false;
  }
}

export async function readDeviceAuthVerifier(
  email: string,
): Promise<DurableLocalAuthVerifier | null> {
  const db = getDeviceAuthDb();
  if (!db) return null;
  try {
    return (await db.verifiers.get(email.trim().toLowerCase())) ?? null;
  } catch {
    return null;
  }
}

export async function deleteDeviceAuthVerifier(email: string): Promise<void> {
  const db = getDeviceAuthDb();
  if (!db) return;
  try {
    await db.verifiers.delete(email.trim().toLowerCase());
  } catch {
    /* already unavailable */
  }
}

export async function clearDeviceAuthVerifiers(): Promise<void> {
  const db = getDeviceAuthDb();
  if (!db) return;
  try {
    await db.verifiers.clear();
  } catch {
    /* already unavailable */
  }
}

/** Ask supporting browsers to protect the POS origin from storage-pressure eviction. */
export async function requestPersistentDeviceStorage(): Promise<boolean | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return null;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
