import { parseDelimitedText, type TabularSheet } from "./parse-delimited";
import { parseXlsxBuffer } from "@/lib/export/xlsx";
import { IMPORT_MAX_FILE_BYTES } from "@/convex/shared/capabilities";

const ALLOWED_EXTENSIONS = new Set(["csv", "tsv", "txt", "xlsx", "xls", "xml"]);

export type ImportFileKind = "csv" | "xlsx" | "xls" | "xml";

export function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? (parts.pop() ?? "") : "";
}

export function assertImportFile(file: File): ImportFileKind {
  if (file.size <= 0) throw new Error("That file is empty.");
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    throw new Error("This file is larger than 5 MB. Split it or save as CSV.");
  }
  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error("Use a CSV or Excel file (.csv, .xlsx, .xls).");
  }
  if (ext === "xlsx") return "xlsx";
  if (ext === "xls") return "xls";
  if (ext === "xml") return "xml";
  return "csv";
}

function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function parseSpreadsheetML(xml: string): TabularSheet {
  const rows: string[][] = [];
  const rowRe = /<Row\b[^>]*>([\s\S]*?)<\/Row>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(xml))) {
    const cells: string[] = [];
    const cellRe = /<Cell\b[^>]*>([\s\S]*?)<\/Cell>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      const data = /<Data\b[^>]*>([\s\S]*?)<\/Data>/i.exec(cellMatch[1]);
      cells.push(data ? decodeXmlText(data[1]) : "");
    }
    if (cells.some((c) => c.trim())) rows.push(cells);
  }
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const width = headers.length;
  return {
    headers,
    rows: rows.slice(1).map((line) => {
      const next = line.slice(0, width);
      while (next.length < width) next.push("");
      return next;
    }),
  };
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

export async function parseImportFile(file: File): Promise<TabularSheet> {
  const kind = assertImportFile(file);
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (kind === "xlsx" || (kind === "xls" && looksLikeZip(buffer))) {
    if (!looksLikeZip(buffer)) {
      throw new Error("This Excel file could not be read. Save it as CSV and try again.");
    }
    return parseXlsxBuffer(buffer);
  }
  const text = new TextDecoder("utf-8").decode(buffer);
  if (kind === "xml" || kind === "xls" || /<Workbook[\s>]/.test(text)) {
    if (/<Workbook[\s>]/.test(text)) return parseSpreadsheetML(text);
  }
  return parseDelimitedText(text);
}
