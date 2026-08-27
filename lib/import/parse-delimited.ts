/**
 * RFC-style CSV/TSV parser. Independent of the mapping and validation layers.
 */

export type TabularSheet = {
  headers: string[];
  rows: string[][];
};

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;

  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") {
      continue;
    }
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((line) => line.some((value) => value.trim().length > 0));
}

function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? "";
  const commas = (firstLine.match(/,/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  if (tabs > commas && tabs >= semis) return "\t";
  if (semis > commas) return ";";
  return ",";
}

export function parseDelimitedText(text: string, delimiter?: string): TabularSheet {
  const delim = delimiter ?? detectDelimiter(text);
  const grid = parseDelimited(text, delim);
  if (grid.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = grid[0].map((h) => h.trim());
  const width = headers.length;
  const rows = grid.slice(1).map((line) => {
    const next = line.slice(0, width);
    while (next.length < width) next.push("");
    return next;
  });
  return { headers, rows };
}

export function sheetToObjects(sheet: TabularSheet): Record<string, string>[] {
  return sheet.rows.map((row) => {
    const obj: Record<string, string> = {};
    sheet.headers.forEach((header, index) => {
      obj[header] = row[index] ?? "";
    });
    return obj;
  });
}
