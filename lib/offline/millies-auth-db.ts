/**
 * Dedicated Dexie for Millie's local auth — independent of the org business replica.
 * Holds setupComplete + localUsers so first boot works before any org bind.
 */

import Dexie, { type EntityTable } from "dexie";

export type MilliesLocalRole = "administrator" | "manager" | "cashier";

export type MilliesLocalUser = {
  id: string;
  username: string;
  displayName: string;
  role: MilliesLocalRole;
  salt: string;
  passwordHash: string;
  iterations: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

export type MilliesAuthMeta = {
  key: string;
  value: string;
};

export type MilliesAuthDb = Dexie & {
  meta: EntityTable<MilliesAuthMeta, "key">;
  localUsers: EntityTable<MilliesLocalUser, "id">;
};

const DB_NAME = "millies-auth-v1";

let instance: MilliesAuthDb | null = null;
let failed = false;

export const MILLIES_AUTH_META = {
  setupComplete: "setupComplete",
  storeName: "storeName",
  storePhone: "storePhone",
  storeAddress: "storeAddress",
  organizationId: "organizationId",
  branchId: "branchId",
  branchName: "branchName",
  recoveryKeySealed: "recoveryKeySealed",
  createdAt: "createdAt",
} as const;

function createDb(): MilliesAuthDb {
  const db = new Dexie(DB_NAME) as MilliesAuthDb;
  db.version(1).stores({
    meta: "key",
    localUsers: "id, username, role, active",
  });
  return db;
}

export async function getMilliesAuthDb(): Promise<MilliesAuthDb | null> {
  if (failed) return null;
  try {
    if (!instance) {
      instance = createDb();
      await instance.open();
    }
    return instance;
  } catch (error) {
    console.info("[millies-auth] IndexedDB unavailable", error);
    failed = true;
    instance = null;
    return null;
  }
}

export async function getAuthMeta(key: string): Promise<string | null> {
  const db = await getMilliesAuthDb();
  if (!db) return null;
  const row = await db.meta.get(key);
  return row?.value ?? null;
}

export async function setAuthMeta(key: string, value: string): Promise<void> {
  const db = await getMilliesAuthDb();
  if (!db) throw new Error("Local storage unavailable");
  await db.meta.put({ key, value });
}

export async function isMilliesSetupComplete(): Promise<boolean> {
  return (await getAuthMeta(MILLIES_AUTH_META.setupComplete)) === "1";
}
