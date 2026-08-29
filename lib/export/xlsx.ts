import { createStoreZip, readStoreZip } from "./zip-store";
import { colLetter, escapeXml } from "./xml";
import { guardSpreadsheetCell } from "./spreadsheet-guard";
import type { ExportTable } from "./types";

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function sheetXml(table: ExportTable): string {
  const rows: string[] = [];
  const headerCells = table.columns
    .map((col, c) => {
      const ref = `${colLetter(c)}1`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(col.header)}</t></is></c>`;
    })
    .join("");
  rows.push(`<row r="1">${headerCells}</row>`);

  table.rows.forEach((row, r) => {
    const cells = table.columns
      .map((col, c) => {
        const ref = `${colLetter(c)}${r + 2}`;
        const raw = row[col.key];
        if (typeof raw === "number" && Number.isFinite(raw)) {
          return `<c r="${ref}"><v>${raw}</v></c>`;
        }
        const text = guardSpreadsheetCell(raw ?? "");
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
      })
      .join("");
    rows.push(`<row r="${r + 2}">${cells}</row>`);
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join("")}</sheetData></worksheet>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Export" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

export function buildXlsxBytes(table: ExportTable): Uint8Array {
  return createStoreZip([
    { name: "[Content_Types].xml", data: utf8(CONTENT_TYPES) },
    { name: "_rels/.rels", data: utf8(RELS) },
    { name: "xl/workbook.xml", data: utf8(WORKBOOK) },
    { name: "xl/_rels/workbook.xml.rels", data: utf8(WORKBOOK_RELS) },
    { name: "xl/worksheets/sheet1.xml", data: utf8(sheetXml(table)) },
  ]);
}

export type ExportWorkbookSheet = {
  name: string;
  table: ExportTable;
};

function safeSheetName(value: string, index: number) {
  const cleaned = value.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31);
  return cleaned || `Sheet ${index + 1}`;
}

/** Builds a standards-compliant multi-sheet workbook for platform submissions. */
export function buildMultiSheetXlsxBytes(sheets: ExportWorkbookSheet[]): Uint8Array {
  if (sheets.length === 0) throw new Error("At least one worksheet is required");
  const names = sheets.map((sheet, index) => safeSheetName(sheet.name, index));
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets
  .map(
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  )
  .join("")}
</Types>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${names
    .map(
      (name, index) =>
        `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("")}</sheets>
</workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets
  .map(
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  )
  .join("")}
</Relationships>`;

  return createStoreZip([
    { name: "[Content_Types].xml", data: utf8(contentTypes) },
    { name: "_rels/.rels", data: utf8(RELS) },
    { name: "xl/workbook.xml", data: utf8(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: utf8(workbookRels) },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: utf8(sheetXml(sheet.table)),
    })),
  ]);
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function columnIndexFromRef(ref: string): number {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n - 1;
}

/** Parse a Novend-generated (inlineStr) worksheet, or simple shared-string sheets. */
export function parseWorksheetXml(xml: string, sharedStrings: string[] = []): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(xml))) {
    const cells = new Map<number, string>();
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch: RegExpExecArray | null;
    let autoIndex = 0;
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = /\br="([A-Z]+\d+)"/i.exec(attrs)?.[1];
      const type = /\bt="([^"]+)"/i.exec(attrs)?.[1] ?? "";
      const index = ref ? columnIndexFromRef(ref) : autoIndex;
      autoIndex = index + 1;
      let value = "";
      const inline = /<t[^>]*>([\s\S]*?)<\/t>/i.exec(body);
      const v = /<v>([\s\S]*?)<\/v>/i.exec(body);
      if (type === "inlineStr" && inline) {
        value = decodeXml(inline[1]);
      } else if (type === "s" && v) {
        value = sharedStrings[Number(v[1])] ?? "";
      } else if (v) {
        value = decodeXml(v[1]);
      } else if (inline) {
        value = decodeXml(inline[1]);
      }
      cells.set(index, value);
    }
    const width = cells.size === 0 ? 0 : Math.max(...cells.keys()) + 1;
    const row: string[] = [];
    for (let i = 0; i < width; i++) row.push(cells.get(i) ?? "");
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
}

export function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const texts = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/gi)].map((m) => decodeXml(m[1]));
    out.push(texts.join(""));
  }
  return out;
}

export function parseXlsxBuffer(buf: Uint8Array): { headers: string[]; rows: string[][] } {
  const files = readStoreZip(buf);
  const sheetEntry =
    [...files.keys()].find((name) => /xl\/worksheets\/sheet1\.xml$/i.test(name)) ??
    [...files.keys()].find((name) => /xl\/worksheets\/sheet\d+\.xml$/i.test(name));
  if (!sheetEntry) {
    throw new Error("This workbook has no worksheet Novend can read. Save as CSV and try again.");
  }
  const decoder = new TextDecoder();
  const sharedName = [...files.keys()].find((name) => /xl\/sharedStrings\.xml$/i.test(name));
  const shared = sharedName ? parseSharedStrings(decoder.decode(files.get(sharedName))) : [];
  const grid = parseWorksheetXml(decoder.decode(files.get(sheetEntry)), shared);
  if (grid.length === 0) return { headers: [], rows: [] };
  const headers = grid[0].map((h) => h.trim());
  const width = headers.length;
  const rows = grid.slice(1).map((line) => {
    const next = line.slice(0, width);
    while (next.length < width) next.push("");
    return next;
  });
  return { headers, rows };
}
