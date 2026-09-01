import { describe, expect, it } from "vitest";
import {
  mappingFromSuggestions,
  suggestColumnMapping,
  unmappedRequiredFields,
} from "@/lib/import/mapping";

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

  it("maps Expiry to expiry date, not tracks-expiry", () => {
    const suggestions = suggestColumnMapping(["Expiry", "Tracks Expiry"]);
    const mapping = mappingFromSuggestions(suggestions);
    expect(mapping.Expiry).toBe("expiryDate");
    expect(mapping["Tracks Expiry"]).toBe("tracksExpiry");
  });

  it("maps Novend catalog export headers, including expiry date", () => {
    const mapping = mappingFromSuggestions(
      suggestColumnMapping([
        "Product ID",
        "Product Name",
        "SKU",
        "Barcode",
        "Category",
        "Description",
        "Cost Price",
        "Selling Price",
        "Stock Quantity",
        "Minimum Stock",
        "Unit",
        "Status",
        "Tracks Expiry",
        "Expiry Alert Days",
        "Expiry Date",
        "Image",
        "Updated",
      ]),
    );
    expect(mapping["Product Name"]).toBe("name");
    expect(mapping["Product ID"]).toBeNull();
    expect(mapping.SKU).toBe("sku");
    expect(mapping.Category).toBe("category");
    expect(mapping["Stock Quantity"]).toBe("quantity");
    expect(mapping["Tracks Expiry"]).toBe("tracksExpiry");
    expect(mapping["Expiry Alert Days"]).toBe("expiryAlertDays");
    expect(mapping["Expiry Date"]).toBe("expiryDate");
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
