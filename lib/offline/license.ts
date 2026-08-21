/**
 * Offline licence cache.
 *
 * Convex stays authoritative for entitlements, but a terminal that loses
 * connectivity must keep selling. The last confirmed licence is stored in the
 * offline database and re-evaluated locally; see `OFFLINE_LICENSE_TTL_MS` in
 * `convex/shared/licensing.ts` for how long a cached licence stays trusted.
 */
import {
  evaluateCachedLicense,
  type LicenseAccess,
  type LicenseSnapshot,
} from "@/convex/shared/licensing";
import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";

export type CachedLicense = LicenseSnapshot & {
  access: LicenseAccess & { stale: boolean };
};

export async function saveLicenseSnapshot(snapshot: LicenseSnapshot): Promise<void> {
  const db = await getOfflineDb();
  if (!db) return;
  await setMeta(db, META_KEYS.licenseSnapshot, JSON.stringify(snapshot));
}

export async function loadLicenseSnapshot(now = Date.now()): Promise<CachedLicense | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const raw = await getMeta(db, META_KEYS.licenseSnapshot);
  if (!raw) return null;
  try {
    const snapshot = JSON.parse(raw) as LicenseSnapshot;
    return { ...snapshot, access: evaluateCachedLicense(snapshot, now) };
  } catch {
    return null;
  }
}

export async function clearLicenseSnapshot(): Promise<void> {
  const db = await getOfflineDb();
  if (!db) return;
  await setMeta(db, META_KEYS.licenseSnapshot, "");
}
