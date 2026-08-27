import { guardSpreadsheetCell } from "./spreadsheet-guard";
import type { ExportTable } from "./types";

export function buildCsvText(table: ExportTable): string {
  const headers = table.columns.map((col) => escapeCsv(col.header));
  const lines = [
    headers.join(","),
    ...table.rows.map((row) =>
      table.columns.map((col) => escapeCsv(guardSpreadsheetCell(row[col.key] ?? ""))).join(","),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
