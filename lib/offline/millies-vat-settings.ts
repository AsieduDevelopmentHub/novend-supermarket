/**
 * Millie's local VAT rate (Dexie only). Prices stay VAT-inclusive; receipts show net / VAT / total.
 */

import {
  DEFAULT_VAT_LABEL,
  DEFAULT_VAT_RATE_PERCENT,
  type VatOrgSettings,
} from "@/convex/shared/vatInclusive";
import { parseTaxVatSettings } from "@/convex/shared/taxVatSettings";
import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";

export const DEFAULT_MILLIES_VAT: VatOrgSettings = {
  ratePercent: DEFAULT_VAT_RATE_PERCENT,
  label: DEFAULT_VAT_LABEL,
};

export async function loadMilliesVatSettings(): Promise<VatOrgSettings> {
  const db = await getOfflineDb();
  if (!db) return { ...DEFAULT_MILLIES_VAT };
  const raw = await getMeta(db, META_KEYS.taxVat);
  return parseTaxVatSettings(raw);
}

export async function saveMilliesVatSettings(settings: VatOrgSettings): Promise<void> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const rate = Number(settings.ratePercent);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error("VAT rate must be between 0 and 100.");
  }
  const label = settings.label.trim().slice(0, 32) || DEFAULT_VAT_LABEL;
  await setMeta(
    db,
    META_KEYS.taxVat,
    JSON.stringify({ ratePercent: Math.round(rate * 100) / 100, label }),
  );
}

/** Seed default rate when capability is on and no settings exist yet. */
export async function ensureMilliesVatSettingsSeeded(): Promise<void> {
  const db = await getOfflineDb();
  if (!db) return;
  const raw = await getMeta(db, META_KEYS.taxVat);
  if (raw && raw.trim()) return;
  await setMeta(db, META_KEYS.taxVat, JSON.stringify(DEFAULT_MILLIES_VAT));
}
