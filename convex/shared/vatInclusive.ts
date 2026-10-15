import { roundMoney } from "./validation";

export type VatInclusiveBreakdown = {
  /** Gross amount charged to the customer (VAT-inclusive). */
  gross: number;
  /** Net of VAT. */
  net: number;
  /** VAT portion of gross. */
  vat: number;
  /** Rate as percent, e.g. 15 for 15%. */
  ratePercent: number;
  label: string;
};

export type VatOrgSettings = {
  ratePercent: number;
  label: string;
};

export const DEFAULT_VAT_LABEL = "VAT";
export const DEFAULT_VAT_RATE_PERCENT = 15;

/** Normalize org VAT settings from capabilitySettings / settings JSON. */
export function parseVatOrgSettings(raw: unknown): VatOrgSettings | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const rate = Number(row.ratePercent ?? row.rate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return null;
  const label =
    typeof row.label === "string" && row.label.trim()
      ? row.label.trim().slice(0, 32)
      : DEFAULT_VAT_LABEL;
  return { ratePercent: roundMoney(rate), label };
}

/**
 * Split a VAT-inclusive gross into net + VAT.
 * gross = net * (1 + rate/100); vat = gross - net.
 */
export function splitVatInclusive(
  gross: number,
  ratePercent: number,
  label = DEFAULT_VAT_LABEL,
): VatInclusiveBreakdown {
  const g = roundMoney(Math.max(0, gross));
  const rate = Math.max(0, Math.min(100, ratePercent));
  if (rate <= 0 || g <= 0) {
    return { gross: g, net: g, vat: 0, ratePercent: rate, label };
  }
  const net = roundMoney(g / (1 + rate / 100));
  const vat = roundMoney(g - net);
  return { gross: g, net, vat, ratePercent: rate, label };
}
