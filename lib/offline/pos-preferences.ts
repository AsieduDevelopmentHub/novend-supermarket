import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";

export type CachedPosPreferences = {
  autoPrintReceipt: boolean;
  receiptPrintMode: "automatic" | "manual" | "never";
};

export const DEFAULT_POS_PREFERENCES: CachedPosPreferences = {
  autoPrintReceipt: false,
  receiptPrintMode: "manual",
};

export async function savePosPreferences(prefs: CachedPosPreferences) {
  const db = await getOfflineDb();
  if (!db) return;
  await setMeta(db, META_KEYS.posPreferences, JSON.stringify(prefs));
}

export async function loadPosPreferences(): Promise<CachedPosPreferences> {
  const db = await getOfflineDb();
  if (!db) return DEFAULT_POS_PREFERENCES;
  const raw = await getMeta(db, META_KEYS.posPreferences);
  if (!raw) return DEFAULT_POS_PREFERENCES;
  try {
    return JSON.parse(raw) as CachedPosPreferences;
  } catch {
    return DEFAULT_POS_PREFERENCES;
  }
}
