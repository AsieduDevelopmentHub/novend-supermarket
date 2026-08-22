import { describe, expect, it } from "vitest";
import {
  BARCODE_ALREADY_ASSIGNED,
  barcodesEqual,
  filterProductsByBarcode,
  productMatchesBarcode,
  productMatchesQuery,
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

  it("treats barcode uniqueness as case-insensitive", () => {
    expect(barcodesEqual("Abc-1", "abc-1")).toBe(true);
    expect(barcodesEqual("", "abc")).toBe(false);
  });

  it("includes barcode in list search", () => {
    const product = { name: "Rice", sku: "RICE-01", barcode: "8901234567890" };
    expect(productMatchesQuery(product, "89012")).toBe(true);
    expect(productMatchesQuery(product, "rice")).toBe(true);
    expect(BARCODE_ALREADY_ASSIGNED).toMatch(/already assigned/);
  });

  it("filters catalog rows by barcode or SKU", () => {
    const catalog = [
      { id: "1", sku: "RICE-01", barcode: "8901234567890" },
      { id: "2", sku: "RICE-02", barcode: null },
    ];
    expect(filterProductsByBarcode(catalog, "8901234567890")).toHaveLength(1);
    expect(filterProductsByBarcode(catalog, "rice-02")).toHaveLength(1);
    expect(filterProductsByBarcode(catalog, "missing")).toHaveLength(0);
  });
});
