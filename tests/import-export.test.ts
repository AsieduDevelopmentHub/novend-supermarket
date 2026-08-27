import { describe, expect, it } from "vitest";
import { guardSpreadsheetCell, needsSpreadsheetGuard } from "@/lib/export/spreadsheet-guard";
import { parseDelimitedText } from "@/lib/import/parse-delimited";
import { buildCsvText } from "@/lib/export/csv";
import { buildXlsxBytes, parseXlsxBuffer } from "@/lib/export/xlsx";
import { assertImportFile } from "@/lib/import/parse-file";

describe("spreadsheet formula guard", () => {
  it("prefixes formula-like cells", () => {
    expect(needsSpreadsheetGuard("=CMD()")).toBe(true);
    expect(guardSpreadsheetCell("+1234")).toBe("'+1234");
    expect(guardSpreadsheetCell("Water")).toBe("Water");
  });
});

describe("delimited parse", () => {
  it("reads quoted commas", () => {
    const sheet = parseDelimitedText('Name,SKU\n"Water, still",WAT-1\n');
    expect(sheet.headers).toEqual(["Name", "SKU"]);
    expect(sheet.rows[0]).toEqual(["Water, still", "WAT-1"]);
  });
});

describe("xlsx round-trip", () => {
  it("writes and reads the Novend workbook", () => {
    const bytes = buildXlsxBytes({
      title: "Products",
      filenameKind: "Products",
      columns: [
        { key: "name", header: "Product Name" },
        { key: "sku", header: "SKU" },
      ],
      rows: [{ name: "Water", sku: "WAT-1" }],
    });
    const parsed = parseXlsxBuffer(bytes);
    expect(parsed.headers).toEqual(["Product Name", "SKU"]);
    expect(parsed.rows[0]).toEqual(["Water", "WAT-1"]);
  });
});

describe("import file guard", () => {
  it("rejects disallowed types and empty files", () => {
    expect(() => assertImportFile(new File(["x"], "x.exe"))).toThrow(/CSV or Excel/i);
    expect(() => assertImportFile(new File([""], "x.csv"))).toThrow(/empty/i);
  });
});

describe("csv export", () => {
  it("guards formula cells in generated CSV", () => {
    const csv = buildCsvText({
      title: "t",
      filenameKind: "t",
      columns: [{ key: "name", header: "Name" }],
      rows: [{ name: "=1+1" }],
    });
    expect(csv).toContain("'=1+1");
  });
});
