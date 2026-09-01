import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";

export type CachedPosPreferences = {
  autoPrintReceipt: boolean;
  receiptPrintMode: "automatic" | "manual" | "never";
};

export const DEFAULT_POS_PREFERENCES: CachedPosPreferences = {
  autoPrintReceipt: false,
  receiptPrintMode: "manual",
};

const POS_PREFS_STORAGE_KEY = "novend.posPreferences";

function readStoredPosPreferences(): CachedPosPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(POS_PREFS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedPosPreferences>;
    if (
      parsed.receiptPrintMode === "automatic" ||
      parsed.receiptPrintMode === "manual" ||
      parsed.receiptPrintMode === "never"
    ) {
      return {
        autoPrintReceipt: parsed.receiptPrintMode === "automatic",
        receiptPrintMode: parsed.receiptPrintMode,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredPosPreferences(prefs: CachedPosPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POS_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode */
  }
}

/** Sync read for first paint (Capacitor must not default to manual before Dexie opens). */
export function peekPosPreferences(): CachedPosPreferences {
  return readStoredPosPreferences() ?? DEFAULT_POS_PREFERENCES;
}

export async function savePosPreferences(prefs: CachedPosPreferences) {
  writeStoredPosPreferences(prefs);
  const db = await getOfflineDb();
  if (!db) return;
  await setMeta(db, META_KEYS.posPreferences, JSON.stringify(prefs));
}

export async function loadPosPreferences(): Promise<CachedPosPreferences> {
  const stored = readStoredPosPreferences();
  if (stored) return stored;
  const db = await getOfflineDb();
  if (!db) return DEFAULT_POS_PREFERENCES;
  const raw = await getMeta(db, META_KEYS.posPreferences);
  if (!raw) return DEFAULT_POS_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as CachedPosPreferences;
    writeStoredPosPreferences(parsed);
    return parsed;
  } catch {
    return DEFAULT_POS_PREFERENCES;
  }
}
