/**
 * Org VAT settings when `tax_vat` capability is enabled.
 * Millie's stores this in Dexie meta (`META_KEYS.taxVat`).
 */

import {
  DEFAULT_VAT_LABEL,
  DEFAULT_VAT_RATE_PERCENT,
  parseVatOrgSettings,
  type VatOrgSettings,
} from "./vatInclusive";

export const TAX_VAT_SETTINGS_KEY = "tax.vat";

export function parseTaxVatSettings(raw: string | undefined | null): VatOrgSettings {
  if (!raw) {
    return { ratePercent: DEFAULT_VAT_RATE_PERCENT, label: DEFAULT_VAT_LABEL };
  }
  try {
    const parsed = parseVatOrgSettings(JSON.parse(raw));
    if (parsed) return parsed;
  } catch {
    /* fall through */
  }
  return { ratePercent: DEFAULT_VAT_RATE_PERCENT, label: DEFAULT_VAT_LABEL };
}
