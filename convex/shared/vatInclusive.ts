import { roundMoney } from "./validation";

/** How selling prices relate to VAT for this organization. */
export type VatPricingMode = "inclusive" | "exclusive";

export type VatBreakdown = {
  /** Amount the customer pays (gross). */
  gross: number;
  /** Net of VAT. */
  net: number;
  /** VAT portion. */
  vat: number;
  /** Rate as percent, e.g. 15 for 15%. */
  ratePercent: number;
  label: string;
  pricingMode: VatPricingMode;
};

/** @deprecated Prefer VatBreakdown — kept for existing call sites. */
export type VatInclusiveBreakdown = VatBreakdown;

export type VatOrgSettings = {
  ratePercent: number;
  label: string;
  /**
   * inclusive — shelf prices already include VAT; receipt splits total.
   * exclusive — shelf prices are net; VAT is added at checkout.
   */
  pricingMode: VatPricingMode;
};

export const DEFAULT_VAT_LABEL = "VAT";
export const DEFAULT_VAT_RATE_PERCENT = 15;
export const DEFAULT_VAT_PRICING_MODE: VatPricingMode = "inclusive";

export function parseVatPricingMode(raw: unknown): VatPricingMode {
  return raw === "exclusive" ? "exclusive" : "inclusive";
}

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
  return {
    ratePercent: roundMoney(rate),
    label,
    pricingMode: parseVatPricingMode(row.pricingMode),
  };
}

/**
 * Split a VAT-inclusive gross into net + VAT.
 * gross = net * (1 + rate/100); vat = gross - net.
 */
export function splitVatInclusive(
  gross: number,
  ratePercent: number,
  label = DEFAULT_VAT_LABEL,
): VatBreakdown {
  const g = roundMoney(Math.max(0, gross));
  const rate = Math.max(0, Math.min(100, ratePercent));
  if (rate <= 0 || g <= 0) {
    return {
      gross: g,
      net: g,
      vat: 0,
      ratePercent: rate,
      label,
      pricingMode: "inclusive",
    };
  }
  const net = roundMoney(g / (1 + rate / 100));
  const vat = roundMoney(g - net);
  return { gross: g, net, vat, ratePercent: rate, label, pricingMode: "inclusive" };
}

/**
 * Add VAT onto a net (exclusive) amount.
 * vat = net * rate/100; gross = net + vat.
 */
export function addVatExclusive(
  netAmount: number,
  ratePercent: number,
  label = DEFAULT_VAT_LABEL,
): VatBreakdown {
  const net = roundMoney(Math.max(0, netAmount));
  const rate = Math.max(0, Math.min(100, ratePercent));
  if (rate <= 0 || net <= 0) {
    return {
      gross: net,
      net,
      vat: 0,
      ratePercent: rate,
      label,
      pricingMode: "exclusive",
    };
  }
  const vat = roundMoney(net * (rate / 100));
  const gross = roundMoney(net + vat);
  return { gross, net, vat, ratePercent: rate, label, pricingMode: "exclusive" };
}

/**
 * Apply org VAT settings to a cart / refund amount after discounts.
 * - inclusive: `amount` is the gross charged; split into net + VAT.
 * - exclusive: `amount` is net; VAT is added so the customer pays `gross`.
 */
export function applyVatToAmount(amount: number, settings: VatOrgSettings): VatBreakdown {
  if (settings.pricingMode === "exclusive") {
    return addVatExclusive(amount, settings.ratePercent, settings.label);
  }
  return splitVatInclusive(amount, settings.ratePercent, settings.label);
}
