import { describe, expect, it } from "vitest";
import { mappingFromSuggestions, suggestColumnMapping, unmappedRequiredFields } from "@/lib/import/mapping";

describe("product import mapping", () => {
  it("maps common client headers to Novend fields", () => {
    const suggestions = suggestColumnMapping([
      "Item Name",
      "Product Code",
      "Selling Price",
      "Cost",
      "Qty",
      "Barcode No",
      "Supplier Name",
    ]);
    const mapping = mappingFromSuggestions(suggestions);
    expect(mapping["Item Name"]).toBe("name");
    expect(mapping["Product Code"]).toBe("sku");
    expect(mapping["Selling Price"]).toBe("sellingPrice");
    expect(mapping["Cost"]).toBe("costPrice");
    expect(mapping["Qty"]).toBe("quantity");
    expect(mapping["Barcode No"]).toBe("barcode");
    expect(mapping["Supplier Name"]).toBeNull();
  });

  it("leaves uncertain headers unmapped", () => {
    const suggestions = suggestColumnMapping(["FooBarBaz", "Category"]);
    expect(suggestions.find((row) => row.header === "FooBarBaz")?.field).toBeNull();
    expect(suggestions.find((row) => row.header === "Category")?.field).toBe("category");
  });

  it("reports missing required fields", () => {
    expect(unmappedRequiredFields({ Name: "name" }).sort()).toEqual(
      ["category", "costPrice", "sellingPrice", "sku"].sort(),
    );
  });
});
