/** Prefix spreadsheet cells that Excel would treat as formulas. */

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function guardSpreadsheetCell(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  if (FORMULA_PREFIX.test(text)) return `'${text}`;
  return text;
}

export function needsSpreadsheetGuard(value: unknown): boolean {
  if (value == null) return false;
  return FORMULA_PREFIX.test(String(value));
}
