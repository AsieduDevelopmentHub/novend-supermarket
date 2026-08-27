import { describe, expect, it } from "vitest";
import { isActualImageRef, pdfView } from "@/lib/export/pdf-layout";
import type { ExportTable } from "@/lib/export/types";

const products: ExportTable = {
  title: "Products",
  filenameKind: "Products",
  columns: [
    { key: "name", header: "Product Name" },
    { key: "sku", header: "SKU" },
    { key: "imageUrl", header: "Image" },
  ],
  rows: [
    { name: "Water", sku: "WAT-1", imageUrl: "https://cdn.convex.cloud/api/storage/abc" },
    { name: "Juice", sku: "JUC-1", imageUrl: "" },
  ],
};

describe("pdf layout", () => {
  it("treats storage URLs as not an actual image for PDF", () => {
    expect(isActualImageRef("https://cdn.convex.cloud/api/storage/abc")).toBe(false);
    expect(isActualImageRef("https://cdn.example.com/photo.png")).toBe(true);
    expect(isActualImageRef("data:image/png;base64,aaa")).toBe(true);
    expect(isActualImageRef("")).toBe(false);
  });

  it("drops the image column from PDF when no row has a real image file", () => {
    const view = pdfView(products);
    expect(view.columns.map((c) => c.key)).toEqual(["name", "sku"]);
  });

  it("keeps the image column as Yes when a file-like image is present", () => {
    const view = pdfView({
      ...products,
      rows: [{ name: "Water", sku: "WAT-1", imageUrl: "https://cdn.example.com/water.jpg" }],
    });
    expect(view.columns.some((c) => c.key === "imageUrl")).toBe(true);
    expect(view.rows[0]?.imageUrl).toBe("Yes");
  });
});
