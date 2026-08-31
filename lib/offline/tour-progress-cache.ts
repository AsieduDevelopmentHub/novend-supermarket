import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";

export type TourProgressStatus = "in_progress" | "completed" | "skipped";

export type StoredTourProgress = {
  tourId: string;
  version: number;
  status: TourProgressStatus;
  lastStepId: string | null;
  startedAt?: number;
  updatedAt: number;
  completedAt?: number | null;
  dirty?: boolean;
};

const LEGACY_PREFIX = "novend.tours.v1:";

export function legacyTourStorageKey(identityKey: string) {
  return `${LEGACY_PREFIX}${identityKey}`;
}

function isStatus(value: unknown): value is TourProgressStatus {
  return value === "in_progress" || value === "completed" || value === "skipped";
}

export function parseTourProgress(value: unknown): StoredTourProgress[] {
  if (!Array.isArray(value)) return [];
  const rows: StoredTourProgress[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.tourId !== "string" || typeof row.version !== "number") continue;
    if (!isStatus(row.status) || typeof row.updatedAt !== "number") continue;
    rows.push({
      tourId: row.tourId,
      version: row.version,
      status: row.status,
      lastStepId: typeof row.lastStepId === "string" ? row.lastStepId : null,
      startedAt: typeof row.startedAt === "number" ? row.startedAt : undefined,
      updatedAt: row.updatedAt,
      completedAt: typeof row.completedAt === "number" ? row.completedAt : null,
      dirty: row.dirty === true,
    });
  }
  return rows;
}

/** Prefer dirty/newer local rows so offline skip/complete is not overwritten by a stale snapshot. */
export function mergeTourProgress(
  local: StoredTourProgress[],
  remote: StoredTourProgress[],
): StoredTourProgress[] {
  const merged: StoredTourProgress[] = remote.map((row) => ({ ...row, dirty: false }));
  for (const row of local) {
    if (!row.dirty) continue;
    const index = merged.findIndex((item) => item.tourId === row.tourId);
    const server = index >= 0 ? merged[index] : undefined;
    if (!server || row.updatedAt > server.updatedAt) {
      if (index >= 0) merged[index] = row;
      else merged.push(row);
    }
  }
  return merged;
}

function readLegacyLocalStorage(identityKey: string): StoredTourProgress[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(legacyTourStorageKey(identityKey)) || "[]",
    ) as unknown;
    return parseTourProgress(parsed);
  } catch {
    return [];
  }
}

function clearLegacyLocalStorage(identityKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(legacyTourStorageKey(identityKey));
  } catch {
    /* private mode */
  }
}

export async function loadTourProgress(identityKey: string): Promise<StoredTourProgress[]> {
  const db = await getOfflineDb();
  if (db) {
    const raw = await getMeta(db, META_KEYS.tourProgress);
    if (raw) {
      try {
        const parsed = parseTourProgress(JSON.parse(raw) as unknown);
        if (parsed.length > 0) return parsed;
      } catch {
        /* fall through to legacy */
      }
    }
  }
  const legacy = readLegacyLocalStorage(identityKey);
  if (legacy.length > 0) {
    await saveTourProgress(legacy);
    clearLegacyLocalStorage(identityKey);
    return legacy;
  }
  return [];
}

export async function saveTourProgress(rows: StoredTourProgress[]) {
  const db = await getOfflineDb();
  if (!db) return;
  await setMeta(db, META_KEYS.tourProgress, JSON.stringify(rows));
}
