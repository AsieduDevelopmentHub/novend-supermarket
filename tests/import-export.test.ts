import { describe, expect, it } from "vitest";
import { guardSpreadsheetCell, needsSpreadsheetGuard } from "@/lib/export/spreadsheet-guard";
import { parseDelimitedText, sheetToObjects } from "@/lib/import/parse-delimited";
import { buildCsvText } from "@/lib/export/csv";
import { buildXlsxBytes, parseXlsxBuffer } from "@/lib/export/xlsx";
import { assertImportFile } from "@/lib/import/parse-file";
import { productExportTable } from "@/lib/export/products";
import { mappingFromSuggestions, suggestColumnMapping } from "@/lib/import/mapping";
import { prepareProductImport } from "@/lib/import/validate-products";

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

describe("catalog export round-trip", () => {
  it("exports expiry date so the same file imports without an expiry conflict", () => {
    const table = productExportTable({
      canViewCost: true,
      rows: [
        {
          id: "p1",
          name: "Juice 500ml",
          sku: "JUC-1",
          barcode: "222",
          categoryName: "Drinks",
          sellingPrice: 4,
          costPrice: 2,
          stockQuantity: 12,
          lowStockThreshold: 4,
          unit: "bottle",
          status: "active",
          tracksExpiry: true,
          expiryAlertDays: 30,
          nearestExpiry: "2027-03-01",
        },
      ],
    });
    expect(table.columns.some((col) => col.header === "Expiry Date")).toBe(true);

    const csv = buildCsvText(table);
    const sheet = parseDelimitedText(csv);
    const mapping = mappingFromSuggestions(suggestColumnMapping(sheet.headers));
    expect(mapping["Expiry Date"]).toBe("expiryDate");
    expect(mapping["Tracks Expiry"]).toBe("tracksExpiry");
    expect(mapping["Product Name"]).toBe("name");

    const records = sheetToObjects(sheet);
    const preview = prepareProductImport({
      mapping,
      maxRows: 500,
      remainingCreates: 10,
      existing: [],
      records,
    });
    expect(preview.issues).toEqual([]);
    expect(preview.createCount).toBe(1);
    expect(preview.rows[0]?.tracksExpiry).toBe(true);
    expect(preview.rows[0]?.expiryDate).toBe("2027-03-01");
    expect(preview.rows[0]?.quantity).toBe(12);
  });
});
