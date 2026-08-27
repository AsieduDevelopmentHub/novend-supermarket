/** Normalize spreadsheet headers and cell text for matching / parsing. */

export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_./\\]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripCell(value: string): string {
  return value.replace(/^\uFEFF/, "").trim();
}

export function parseMoneyCell(raw: string): number | null {
  const text = stripCell(raw).replace(/,/g, "").replace(/^[^\d-]+/, "");
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function parseIntegerCell(raw: string): number | null {
  const text = stripCell(raw).replace(/,/g, "");
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

export function parseBooleanCell(raw: string): boolean | null {
  const text = stripCell(raw).toLowerCase();
  if (!text) return null;
  if (["1", "true", "yes", "y", "on"].includes(text)) return true;
  if (["0", "false", "no", "n", "off"].includes(text)) return false;
  return null;
}

export function parseStatusCell(raw: string): "active" | "inactive" | null {
  const text = stripCell(raw).toLowerCase();
  if (!text) return null;
  if (["active", "enabled", "yes", "1"].includes(text)) return "active";
  if (["inactive", "disabled", "no", "0"].includes(text)) return "inactive";
  if (text === "archived") return "inactive";
  return null;
}
