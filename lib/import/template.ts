import { PRODUCT_IMPORT_FIELDS } from "./product-fields";
import { buildCsvText } from "@/lib/export/csv";
import { buildXlsxBytes } from "@/lib/export/xlsx";
import { brandedDocumentName } from "@/lib/export-filenames";
import { bytesToBlob, downloadBlob } from "@/lib/export/download";
import type { ExportTable } from "@/lib/export/types";

function templateTable(): ExportTable {
  const example: Record<string, unknown> = {
    name: "Bottled Water 500ml",
    sku: "WAT-500",
    barcode: "1234567890123",
    category: "Beverages",
    costPrice: 1.2,
    sellingPrice: 2,
    quantity: 48,
    unit: "bottle",
    lowStockThreshold: 10,
    description: "",
    status: "active",
    tracksExpiry: "no",
    expiryAlertDays: "",
    expiryDate: "",
  };
  return {
    title: "Product import template",
    filenameKind: "Product-Import-Template",
    columns: PRODUCT_IMPORT_FIELDS.map((field) => ({ key: field.key, header: field.label })),
    rows: [example],
  };
}

export async function downloadProductImportTemplate(format: "csv" | "xlsx") {
  const table = templateTable();
  const filename = brandedDocumentName("Product-Import-Template", undefined, format);
  if (format === "csv") {
    await downloadBlob(
      filename,
      new Blob([buildCsvText(table)], { type: "text/csv;charset=utf-8" }),
    );
    return;
  }
  await downloadBlob(
    filename,
    bytesToBlob(
      buildXlsxBytes(table),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
  );
}
