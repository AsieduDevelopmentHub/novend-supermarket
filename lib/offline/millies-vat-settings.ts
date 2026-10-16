/**
 * Millie's local VAT settings.
 * Canonical store: millies-auth Dexie (survives business-replica rebuilds).
 * Mirrored into the org replica meta so sales/returns can read META_KEYS.taxVat.
 */

import {
  DEFAULT_VAT_LABEL,
  DEFAULT_VAT_PRICING_MODE,
  DEFAULT_VAT_RATE_PERCENT,
  type VatOrgSettings,
} from "@/convex/shared/vatInclusive";
import { parseTaxVatSettings } from "@/convex/shared/taxVatSettings";
import { getAuthMeta, MILLIES_AUTH_META, setAuthMeta } from "./millies-auth-db";
import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";

export const DEFAULT_MILLIES_VAT: VatOrgSettings = {
  ratePercent: DEFAULT_VAT_RATE_PERCENT,
  label: DEFAULT_VAT_LABEL,
  pricingMode: DEFAULT_VAT_PRICING_MODE,
};

function serializeVat(settings: VatOrgSettings): string {
  return JSON.stringify({
    ratePercent: Math.round(Number(settings.ratePercent) * 100) / 100,
    label: settings.label.trim().slice(0, 32) || DEFAULT_VAT_LABEL,
    pricingMode: settings.pricingMode === "exclusive" ? "exclusive" : "inclusive",
  });
}

/** Push canonical VAT into the business replica (best-effort). */
async function mirrorVatToReplica(raw: string): Promise<void> {
  try {
    const db = await getOfflineDb();
    if (!db) return;
    await setMeta(db, META_KEYS.taxVat, raw);
  } catch (error) {
    console.info("[millies] VAT replica mirror skipped", error);
  }
}

export async function loadMilliesVatSettings(): Promise<VatOrgSettings> {
  // Auth DB is durable across replica rebuilds. Read-only — never mirror here
  // (callers may be inside a business-replica Dexie transaction).
  const fromAuth = await getAuthMeta(MILLIES_AUTH_META.taxVat).catch(() => null);
  if (fromAuth?.trim()) {
    return parseTaxVatSettings(fromAuth);
  }

  // Migrate once from replica if an older install only stored it there.
  try {
    const db = await getOfflineDb();
    if (db) {
      const fromReplica = await getMeta(db, META_KEYS.taxVat);
      if (fromReplica?.trim()) {
        await setAuthMeta(MILLIES_AUTH_META.taxVat, fromReplica).catch(() => undefined);
        return parseTaxVatSettings(fromReplica);
      }
    }
  } catch {
    /* fall through to default */
  }

  return { ...DEFAULT_MILLIES_VAT };
}

export async function saveMilliesVatSettings(settings: VatOrgSettings): Promise<void> {
  const rate = Number(settings.ratePercent);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error("VAT rate must be between 0 and 100.");
  }
  const raw = serializeVat({
    ratePercent: rate,
    label: settings.label,
    pricingMode: settings.pricingMode,
  });
  // Canonical write — must succeed.
  await setAuthMeta(MILLIES_AUTH_META.taxVat, raw);
  await mirrorVatToReplica(raw);
}

/**
 * Seed default rate only when neither auth nor replica has settings.
 * Never overwrites a saved rate.
 */
export async function ensureMilliesVatSettingsSeeded(): Promise<void> {
  try {
    const fromAuth = await getAuthMeta(MILLIES_AUTH_META.taxVat).catch(() => null);
    if (fromAuth?.trim()) {
      await mirrorVatToReplica(fromAuth);
      return;
    }

    let fromReplica: string | null = null;
    try {
      const db = await getOfflineDb();
      if (db) fromReplica = await getMeta(db, META_KEYS.taxVat);
    } catch {
      fromReplica = null;
    }
    if (fromReplica?.trim()) {
      await setAuthMeta(MILLIES_AUTH_META.taxVat, fromReplica);
      return;
    }

    const raw = serializeVat(DEFAULT_MILLIES_VAT);
    await setAuthMeta(MILLIES_AUTH_META.taxVat, raw);
    await mirrorVatToReplica(raw);
  } catch (error) {
    console.info("[millies] VAT seed skipped", error);
  }
}
