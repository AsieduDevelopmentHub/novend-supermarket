import { describe, expect, it } from "vitest";
import {
  BARCODE_ALREADY_ASSIGNED,
  barcodesEqual,
  filterProductsByBarcode,
  productMatchesBarcode,
  productMatchesQuery,
  resolveBarcodeMatch,
} from "@/lib/offline/barcode-lookup";

describe("barcode lookup", () => {
  it("matches dedicated barcode before SKU", () => {
    const product = { sku: "RICE-01", barcode: "8901234567890" };
    expect(productMatchesBarcode(product, "8901234567890")).toBe(true);
    expect(productMatchesBarcode(product, "RICE-01")).toBe(true);
    expect(productMatchesBarcode(product, "nope")).toBe(false);
  });

  it("falls back to SKU when no barcode is assigned", () => {
    expect(productMatchesBarcode({ sku: "RICE-01" }, "rice-01")).toBe(true);
  });

  it("matches sell-unit barcodes and returns the unit key", () => {
    const product = {
      sku: "RICE-01",
      barcode: "8901234567890",
      sellUnits: [
        { key: "piece", barcode: "111", active: true },
        { key: "carton", barcode: "222-CARTON", active: true },
        { key: "old", barcode: "333", active: false },
      ],
    };
    expect(resolveBarcodeMatch(product, "222-carton")).toEqual({
      kind: "sell_unit",
      sellUnitKey: "carton",
    });
    expect(productMatchesBarcode(product, "222-CARTON")).toBe(true);
    expect(resolveBarcodeMatch(product, "333")).toBeNull();
    expect(resolveBarcodeMatch(product, "8901234567890")?.kind).toBe("product_barcode");
  });

  it("treats barcode uniqueness as case-insensitive", () => {
    expect(barcodesEqual("Abc-1", "abc-1")).toBe(true);
    expect(barcodesEqual("", "abc")).toBe(false);
  });

  it("includes barcode in list search", () => {
    const product = {
      name: "Rice",
      sku: "RICE-01",
      barcode: "8901234567890",
      sellUnits: [{ key: "carton", barcode: "999", active: true }],
    };
    expect(productMatchesQuery(product, "89012")).toBe(true);
    expect(productMatchesQuery(product, "999")).toBe(true);
    expect(productMatchesQuery(product, "rice")).toBe(true);
    expect(BARCODE_ALREADY_ASSIGNED).toMatch(/already assigned/);
  });

  it("filters catalog rows by barcode or SKU", () => {
    const catalog = [
      { id: "1", sku: "RICE-01", barcode: "8901234567890" },
      { id: "2", sku: "RICE-02", barcode: null },
      {
        id: "3",
        sku: "OIL-01",
        barcode: null,
        sellUnits: [{ key: "crate", barcode: "CRATE-9", active: true }],
      },
    ];
    expect(filterProductsByBarcode(catalog, "8901234567890")).toHaveLength(1);
    expect(filterProductsByBarcode(catalog, "rice-02")).toHaveLength(1);
    expect(filterProductsByBarcode(catalog, "CRATE-9")).toHaveLength(1);
    expect(filterProductsByBarcode(catalog, "missing")).toHaveLength(0);
  });
});
