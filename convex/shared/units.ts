/**
 * Unit-of-measure conversion and legacy product adapters (Stage 2+).
 * Inventory always mutates in base quantity. See ROADMAP_CAPABILITIES.md.
 */

import { roundMoney } from "./validation";

/** configurationVersion when UOM adapters / sale-line snapshots are active. */
export const UOM_CONFIGURATION_VERSION = 2;

export type PricingMode = "fixed" | "per_weight";

export type ProductSellUnit = {
  key: string;
  label: string;
  factorToBase: number;
  barcode?: string;
  /** Absolute price for one sell unit (not per base). */
  sellingPrice?: number;
  active: boolean;
};

export type ProductUnitFields = {
  unit: string;
  sellingPrice: number;
  costPrice: number;
  sellUnits?: ProductSellUnit[] | null;
  pricingMode?: PricingMode | null;
};

export type ResolvedSellUnit = {
  key: string;
  label: string;
  factorToBase: number;
  barcode?: string;
  /** Price charged per displayed sell-unit quantity. */
  unitPrice: number;
  /** Cost attributed per base unit (product.costPrice). */
  costPerBase: number;
  pricingMode: PricingMode;
  synthesized: boolean;
};

const QTY_SCALE = 1_000_000;

/** Decimal-safe quantity rounding (up to 6 decimal places). */
export function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * QTY_SCALE) / QTY_SCALE;
}

export function assertSellQuantity(
  value: number,
  options?: { allowFractional?: boolean },
): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Quantity must be a positive number");
  }
  if (!options?.allowFractional && !Number.isInteger(value)) {
    throw new Error("Quantity must be a positive integer");
  }
  if (options?.allowFractional && roundQuantity(value) !== value && value !== roundQuantity(value)) {
    // allow float noise — normalize callers should pass roundQuantity
  }
}

export function toBaseQuantity(displayedQuantity: number, factorToBase: number): number {
  if (!Number.isFinite(factorToBase) || factorToBase <= 0) {
    throw new Error("Invalid unit conversion factor");
  }
  return roundQuantity(displayedQuantity * factorToBase);
}

export function fromBaseQuantity(baseQuantity: number, factorToBase: number): number {
  if (!Number.isFinite(factorToBase) || factorToBase <= 0) {
    throw new Error("Invalid unit conversion factor");
  }
  return roundQuantity(baseQuantity / factorToBase);
}

/**
 * Legacy products (no sellUnits) → one active sell unit with factor 1.
 * When multi_unit / weight capabilities are off, callers still use this path.
 */
export function synthesizeDefaultSellUnit(product: ProductUnitFields): ResolvedSellUnit {
  const label = product.unit?.trim() || "unit";
  return {
    key: "default",
    label,
    factorToBase: 1,
    unitPrice: product.sellingPrice,
    costPerBase: product.costPrice,
    pricingMode: product.pricingMode === "per_weight" ? "per_weight" : "fixed",
    synthesized: true,
  };
}

export function listActiveSellUnits(product: ProductUnitFields): ResolvedSellUnit[] {
  const mode: PricingMode = product.pricingMode === "per_weight" ? "per_weight" : "fixed";
  const configured = (product.sellUnits ?? []).filter((u) => u.active && u.factorToBase > 0);
  if (configured.length === 0) {
    return [synthesizeDefaultSellUnit(product)];
  }
  return configured.map((u) => ({
    key: u.key,
    label: u.label,
    factorToBase: u.factorToBase,
    barcode: u.barcode,
    unitPrice:
      typeof u.sellingPrice === "number" && Number.isFinite(u.sellingPrice)
        ? u.sellingPrice
        : roundMoney(product.sellingPrice * u.factorToBase),
    costPerBase: product.costPrice,
    pricingMode: mode,
    synthesized: false,
  }));
}

export function resolveSellUnit(
  product: ProductUnitFields,
  sellUnitKey?: string | null,
): ResolvedSellUnit {
  const units = listActiveSellUnits(product);
  if (!sellUnitKey) return units[0]!;
  const match = units.find((u) => u.key === sellUnitKey);
  if (!match) throw new Error("Sell unit not found for product");
  return match;
}

export function lineGrossForSellUnit(
  unit: ResolvedSellUnit,
  displayedQuantity: number,
): number {
  return roundMoney(unit.unitPrice * displayedQuantity);
}

export function lineUnitCostTotal(unit: ResolvedSellUnit, baseQuantity: number): number {
  return roundMoney(unit.costPerBase * baseQuantity);
}

export type SaleLineUnitSnapshot = {
  sellUnitKey: string;
  sellUnitLabel: string;
  displayedQuantity: number;
  baseQuantity: number;
  factorToBase: number;
  pricingMode: PricingMode;
};

export function buildSaleLineUnitSnapshot(
  unit: ResolvedSellUnit,
  displayedQuantity: number,
): SaleLineUnitSnapshot {
  const baseQuantity = toBaseQuantity(displayedQuantity, unit.factorToBase);
  return {
    sellUnitKey: unit.key,
    sellUnitLabel: unit.label,
    displayedQuantity: roundQuantity(displayedQuantity),
    baseQuantity,
    factorToBase: unit.factorToBase,
    pricingMode: unit.pricingMode,
  };
}
