import type { ExportTable } from "./types";

export type ProductExportSource = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryName: string;
  description?: string | null;
  costPrice?: number;
  sellingPrice: number;
  stockQuantity: number;
  lowStockThreshold?: number;
  unit: string;
  status: string;
  tracksExpiry?: boolean;
  expiryAlertDays?: number | null;
  imageUrl?: string | null;
  updatedAt?: number;
};

export function productExportTable(args: {
  rows: ProductExportSource[];
  canViewCost: boolean;
  branchLabel?: string;
}): ExportTable {
  const columns = [
    { key: "id", header: "Product ID" },
    { key: "name", header: "Product Name" },
    { key: "sku", header: "SKU" },
    { key: "barcode", header: "Barcode" },
    { key: "categoryName", header: "Category" },
    { key: "description", header: "Description" },
    ...(args.canViewCost ? [{ key: "costPrice", header: "Cost Price" }] : []),
    { key: "sellingPrice", header: "Selling Price" },
    { key: "stockQuantity", header: "Stock Quantity" },
    { key: "lowStockThreshold", header: "Minimum Stock" },
    { key: "unit", header: "Unit" },
    { key: "status", header: "Status" },
    { key: "tracksExpiry", header: "Tracks Expiry" },
    { key: "expiryAlertDays", header: "Expiry Alert Days" },
    { key: "imageUrl", header: "Image" },
    { key: "updatedAt", header: "Updated" },
  ];

  return {
    title: "Products",
    filenameKind: "Products",
    columns,
    meta: args.branchLabel ? { Branch: args.branchLabel } : undefined,
    rows: args.rows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      barcode: row.barcode ?? "",
      categoryName: row.categoryName,
      description: row.description ?? "",
      ...(args.canViewCost ? { costPrice: row.costPrice ?? "" } : {}),
      sellingPrice: row.sellingPrice,
      stockQuantity: row.stockQuantity,
      lowStockThreshold: row.lowStockThreshold ?? "",
      unit: row.unit,
      status: row.status,
      tracksExpiry: row.tracksExpiry ? "yes" : "no",
      expiryAlertDays: row.expiryAlertDays ?? "",
      imageUrl: row.imageUrl ?? "",
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : "",
    })),
  };
}
