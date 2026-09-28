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
  const text = stripCell(raw)
    .replace(/,/g, "")
    .replace(/^[^\d-]+/, "");
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

/** Opening-stock expiry. Accepts YYYY-MM-DD or dd/mm/yyyy (Ghana/EU). */
export function parseExpiryDateCell(raw: string): string | null {
  const text = stripCell(raw);
  if (!text) return null;
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    const value = iso[1];
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return null;
    }
    return value;
  }
  // Spreadsheet cells often use dd/mm/yyyy — never treat as US mm/dd.
  const dmy = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!dmy) return null;
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  const year = Number(dmy[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseStatusCell(raw: string): "active" | "inactive" | null {
  const text = stripCell(raw).toLowerCase();
  if (!text) return null;
  if (["active", "enabled", "yes", "1"].includes(text)) return "active";
  if (["inactive", "disabled", "no", "0"].includes(text)) return "inactive";
  if (text === "archived") return "inactive";
  return null;
}
