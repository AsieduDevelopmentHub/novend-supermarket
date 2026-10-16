/**
 * Org VAT settings when `tax_vat` capability is enabled.
 * Millie's stores this in Dexie meta (`META_KEYS.taxVat`).
 */

import {
  DEFAULT_VAT_LABEL,
  DEFAULT_VAT_PRICING_MODE,
  DEFAULT_VAT_RATE_PERCENT,
  parseVatOrgSettings,
  type VatOrgSettings,
} from "./vatInclusive";

export const TAX_VAT_SETTINGS_KEY = "tax.vat";

export const DEFAULT_TAX_VAT_SETTINGS: VatOrgSettings = {
  ratePercent: DEFAULT_VAT_RATE_PERCENT,
  label: DEFAULT_VAT_LABEL,
  pricingMode: DEFAULT_VAT_PRICING_MODE,
};

export function parseTaxVatSettings(raw: string | undefined | null): VatOrgSettings {
  if (!raw) {
    return { ...DEFAULT_TAX_VAT_SETTINGS };
  }
  try {
    const parsed = parseVatOrgSettings(JSON.parse(raw));
    if (parsed) return parsed;
  } catch {
    /* fall through */
  }
  return { ...DEFAULT_TAX_VAT_SETTINGS };
}
