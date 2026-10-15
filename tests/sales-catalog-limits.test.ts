import { describe, expect, it } from "vitest";
import {
  SALES_CATALOG_BROWSE_LIMIT,
  catalogSearchRank,
  salesCatalogResultLimit,
} from "@/constants/sales-catalog";

describe("sales catalog limits", () => {
  it("caps browse only — typed search returns every match", () => {
    expect(salesCatalogResultLimit("")).toBe(SALES_CATALOG_BROWSE_LIMIT);
    expect(salesCatalogResultLimit("   ")).toBe(SALES_CATALOG_BROWSE_LIMIT);
    expect(salesCatalogResultLimit("rice")).toBeNull();
  });

  it("ranks exact sku/barcode ahead of partial name matches", () => {
    const q = "rice";
    const exactSku = catalogSearchRank({ name: "Basmati", sku: "rice", barcode: null }, q);
    const prefixName = catalogSearchRank({ name: "Rice flour", sku: "FLOUR-1", barcode: null }, q);
    const includesName = catalogSearchRank({ name: "Brown rice", sku: "BR-1", barcode: null }, q);
    expect(exactSku).toBeLessThan(prefixName);
    expect(prefixName).toBeLessThan(includesName);
  });
});
