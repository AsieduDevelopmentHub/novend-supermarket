/**
 * Round-trip sell units (multi-pack) for product CSV/XLSX export ↔ import.
 * One cell, JSON array — keeps pack/carton labels, factors, barcodes, and prices.
 */

import type { ProductSellUnit } from "@/convex/shared/units";
import { stripCell } from "./normalize";

export function serializeSellUnits(units: ProductSellUnit[] | null | undefined): string {
  if (!units?.length) return "";
  return JSON.stringify(
    units.map((unit) => ({
      key: unit.key,
      label: unit.label,
      factorToBase: unit.factorToBase,
      ...(unit.barcode ? { barcode: unit.barcode } : {}),
      ...(unit.sellingPrice != null ? { sellingPrice: unit.sellingPrice } : {}),
      active: unit.active !== false,
    })),
  );
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Parse a Sell Units cell. Empty → null (leave existing). Invalid → throws. */
export function parseSellUnitsCell(raw: string): ProductSellUnit[] | null {
  const trimmed = stripCell(raw);
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Sell Units must be a JSON array from a Novend product export");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Sell Units must be a JSON array");
  }
  if (parsed.length === 0) return [];

  const units: ProductSellUnit[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") {
      throw new Error("Each sell unit must be an object");
    }
    const record = row as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const keyRaw = typeof record.key === "string" ? record.key.trim() : "";
    const factorToBase = Number(record.factorToBase);
    if (!label || !isFinitePositive(factorToBase)) {
      throw new Error("Each sell unit needs a label and a positive factorToBase");
    }
    const barcode =
      typeof record.barcode === "string" && record.barcode.trim()
        ? record.barcode.trim()
        : undefined;
    const sellingPriceRaw =
      record.sellingPrice === undefined || record.sellingPrice === null || record.sellingPrice === ""
        ? undefined
        : Number(record.sellingPrice);
    if (
      sellingPriceRaw !== undefined &&
      (!Number.isFinite(sellingPriceRaw) || sellingPriceRaw < 0)
    ) {
      throw new Error(`Invalid sellingPrice for sell unit “${label}”`);
    }
    units.push({
      key: keyRaw || `unit_${units.length + 1}`,
      label,
      factorToBase,
      barcode,
      sellingPrice: sellingPriceRaw,
      active: record.active !== false,
    });
  }
  if (!units.some((unit) => unit.active)) {
    throw new Error("Keep at least one active sell unit");
  }
  return units;
}
