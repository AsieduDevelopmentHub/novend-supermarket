/** Whole units from a phone keypad (no minus / decimal). */

export function parseUnsignedInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

export function parsePositiveInt(raw: string): number | null {
  const n = parseUnsignedInt(raw);
  if (n === null || n < 1) return null;
  return n;
}

export function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function signedStockDelta(direction: "add" | "remove", raw: string): number | null {
  const n = parsePositiveInt(raw);
  if (n === null) return null;
  return direction === "remove" ? -n : n;
}

export function digitsOnly(raw: string) {
  return raw.replace(/[^\d]/g, "");
}
