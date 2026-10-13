/**
 * Serial / IMEI tracking helpers (serial_tracking capability).
 */

import { roundQuantity } from "./units";

export function normalizeSerial(value: string): string {
  return value.normalize("NFKC").trim().toUpperCase();
}

export function assertSerialListForQuantity(
  serials: string[] | undefined,
  baseQuantity: number,
  productName: string,
): string[] {
  const qty = roundQuantity(baseQuantity);
  if (!Number.isInteger(qty) || qty < 1) {
    throw new Error(`Serial tracking requires whole-unit quantities for ${productName}`);
  }
  const cleaned = (serials ?? []).map(normalizeSerial).filter(Boolean);
  if (cleaned.length !== qty) {
    throw new Error(
      `Enter ${qty} serial number${qty === 1 ? "" : "s"} for ${productName} (got ${cleaned.length}).`,
    );
  }
  const unique = new Set(cleaned);
  if (unique.size !== cleaned.length) {
    throw new Error(`Duplicate serial numbers for ${productName}`);
  }
  return cleaned;
}
