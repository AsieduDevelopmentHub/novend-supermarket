import { describe, expect, it } from "vitest";
import { prepareProductImport } from "@/lib/import/validate-products";
import type { ColumnMapping } from "@/lib/import/mapping";

const mapping: ColumnMapping = {
  name: "name",
  sku: "sku",
  category: "category",
  cost: "costPrice",
  price: "sellingPrice",
  qty: "quantity",
  barcode: "barcode",
};

describe("product import validation", () => {
  it("previews creates vs updates by SKU", () => {
    const preview = prepareProductImport({
      mapping,
      maxRows: 500,
      remainingCreates: 10,
      existing: [{ id: "p1", sku: "WAT-500", barcode: "111" }],
      records: [
        {
          name: "Water",
          sku: "WAT-500",
          category: "Drinks",
          cost: "1",
          price: "2",
          qty: "10",
          barcode: "",
        },
        {
          name: "Juice",
          sku: "JUC-1",
          category: "Drinks",
          cost: "2",
          price: "4",
          qty: "5",
          barcode: "222",
        },
      ],
    });
    expect(preview.updateCount).toBe(1);
    expect(preview.createCount).toBe(1);
    expect(preview.rows.find((r) => r.sku === "WAT-500")?.quantityIgnoredOnUpdate).toBe(true);
  });

  it("rejects duplicate SKUs in the file", () => {
    const preview = prepareProductImport({
      mapping,
      maxRows: 500,
      remainingCreates: 10,
      existing: [],
      records: [
        { name: "A", sku: "X", category: "C", cost: "1", price: "2", qty: "1", barcode: "" },
        { name: "B", sku: "X", category: "C", cost: "1", price: "2", qty: "1", barcode: "" },
      ],
    });
    expect(preview.issues.some((issue) => issue.message.includes("duplicated"))).toBe(true);
  });

  it("blocks creates past the remaining product capacity", () => {
    const preview = prepareProductImport({
      mapping,
      maxRows: 500,
      remainingCreates: 0,
      existing: [],
      records: [
        { name: "A", sku: "X", category: "C", cost: "1", price: "2", qty: "1", barcode: "" },
      ],
    });
    expect(preview.createCount).toBe(0);
    expect(preview.issues[0]?.message).toMatch(/limit/i);
  });
});
