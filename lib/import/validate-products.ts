import type { ColumnMapping } from "./mapping";
import type { ProductImportFieldKey } from "./product-fields";
import {
  parseBooleanCell,
  parseExpiryDateCell,
  parseIntegerCell,
  parseMoneyCell,
  parseStatusCell,
  stripCell,
} from "./normalize";

export type ExistingProductRef = {
  id: string;
  sku: string;
  barcode?: string | null;
};

export type PreparedImportRow = {
  rowNumber: number;
  action: "create" | "update" | "skip";
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
  description?: string;
  status: "active" | "inactive";
  tracksExpiry: boolean;
  expiryAlertDays?: number;
  expiryDate?: string;
  existingId?: string;
  skipReason?: string;
  quantityIgnoredOnUpdate?: boolean;
};

export type RowIssue = {
  rowNumber: number;
  field?: ProductImportFieldKey | "file";
  message: string;
};

export type ImportPreview = {
  rows: PreparedImportRow[];
  issues: RowIssue[];
  createCount: number;
  updateCount: number;
  skipCount: number;
  invalidCount: number;
};

function mappedValue(
  record: Record<string, string>,
  mapping: ColumnMapping,
  key: ProductImportFieldKey,
): string {
  for (const [header, field] of Object.entries(mapping)) {
    if (field === key) return record[header] ?? "";
  }
  return "";
}

function skuKey(sku: string): string {
  return sku.trim().toLowerCase();
}

function barcodeKey(barcode: string): string {
  return barcode.trim().toLowerCase();
}

export function prepareProductImport(args: {
  records: Record<string, string>[];
  mapping: ColumnMapping;
  existing: ExistingProductRef[];
  maxRows: number;
  remainingCreates: number | null;
}): ImportPreview {
  const issues: RowIssue[] = [];
  const rows: PreparedImportRow[] = [];
  if (args.records.length > args.maxRows) {
    issues.push({
      rowNumber: 0,
      field: "file",
      message: `This file has ${args.records.length} data rows. The limit for this plan is ${args.maxRows}.`,
    });
    return {
      rows: [],
      issues,
      createCount: 0,
      updateCount: 0,
      skipCount: 0,
      invalidCount: args.records.length,
    };
  }

  const existingBySku = new Map(args.existing.map((p) => [skuKey(p.sku), p]));
  const existingByBarcode = new Map(
    args.existing.filter((p) => p.barcode).map((p) => [barcodeKey(p.barcode!), p]),
  );
  const fileSkus = new Map<string, number>();
  const fileBarcodes = new Map<string, number>();
  let createsSoFar = 0;

  args.records.forEach((record, index) => {
    const rowNumber = index + 2;
    const name = stripCell(mappedValue(record, args.mapping, "name"));
    const sku = stripCell(mappedValue(record, args.mapping, "sku"));
    const barcodeRaw = stripCell(mappedValue(record, args.mapping, "barcode"));
    const category = stripCell(mappedValue(record, args.mapping, "category"));
    const costRaw = mappedValue(record, args.mapping, "costPrice");
    const sellRaw = mappedValue(record, args.mapping, "sellingPrice");
    const qtyRaw = mappedValue(record, args.mapping, "quantity");
    const unitRaw = stripCell(mappedValue(record, args.mapping, "unit"));
    const lowRaw = mappedValue(record, args.mapping, "lowStockThreshold");
    const descriptionRaw = stripCell(mappedValue(record, args.mapping, "description"));
    const statusRaw = mappedValue(record, args.mapping, "status");
    const tracksRaw = mappedValue(record, args.mapping, "tracksExpiry");
    const alertRaw = mappedValue(record, args.mapping, "expiryAlertDays");
    const expiryRaw = mappedValue(record, args.mapping, "expiryDate");

    const empty =
      !name &&
      !sku &&
      !barcodeRaw &&
      !category &&
      !stripCell(costRaw) &&
      !stripCell(sellRaw) &&
      !stripCell(qtyRaw);
    if (empty) return;

    const rowIssues: RowIssue[] = [];
    if (!name) rowIssues.push({ rowNumber, field: "name", message: "Product name is required." });
    if (!sku) rowIssues.push({ rowNumber, field: "sku", message: "SKU is required." });
    if (!category)
      rowIssues.push({ rowNumber, field: "category", message: "Category is required." });

    const costPrice = parseMoneyCell(costRaw);
    const sellingPrice = parseMoneyCell(sellRaw);
    if (costPrice == null) {
      rowIssues.push({
        rowNumber,
        field: "costPrice",
        message: "Cost price must be a number 0 or more.",
      });
    }
    if (sellingPrice == null) {
      rowIssues.push({
        rowNumber,
        field: "sellingPrice",
        message: "Selling price must be a number 0 or more.",
      });
    }

    let quantity = 0;
    if (stripCell(qtyRaw)) {
      const qty = parseIntegerCell(qtyRaw);
      if (qty == null) {
        rowIssues.push({
          rowNumber,
          field: "quantity",
          message: "Quantity must be a whole number 0 or more.",
        });
      } else {
        quantity = qty;
      }
    }

    let lowStockThreshold = 5;
    if (stripCell(lowRaw)) {
      const low = parseIntegerCell(lowRaw);
      if (low == null) {
        rowIssues.push({
          rowNumber,
          field: "lowStockThreshold",
          message: "Minimum stock must be a whole number 0 or more.",
        });
      } else {
        lowStockThreshold = low;
      }
    }

    const status = stripCell(statusRaw) ? parseStatusCell(statusRaw) : "active";
    if (stripCell(statusRaw) && status == null) {
      rowIssues.push({ rowNumber, field: "status", message: "Status must be active or inactive." });
    }

    let tracksExpiry = false;
    if (stripCell(tracksRaw)) {
      const parsed = parseBooleanCell(tracksRaw);
      if (parsed == null) {
        rowIssues.push({
          rowNumber,
          field: "tracksExpiry",
          message: "Tracks expiry must be yes or no.",
        });
      } else {
        tracksExpiry = parsed;
      }
    }

    let expiryAlertDays: number | undefined;
    if (stripCell(alertRaw)) {
      const days = parseIntegerCell(alertRaw);
      if (days == null || days > 3650) {
        rowIssues.push({
          rowNumber,
          field: "expiryAlertDays",
          message: "Expiry alert days must be between 0 and 3650.",
        });
      } else {
        expiryAlertDays = days;
      }
    }

    let expiryDate: string | undefined;
    if (stripCell(expiryRaw)) {
      const parsed = parseExpiryDateCell(expiryRaw);
      if (!parsed) {
        rowIssues.push({
          rowNumber,
          field: "expiryDate",
          message: "Expiry date must be YYYY-MM-DD.",
        });
      } else {
        expiryDate = parsed;
      }
    }

    if (sku) {
      const prev = fileSkus.get(skuKey(sku));
      if (prev) {
        rowIssues.push({
          rowNumber,
          field: "sku",
          message: `SKU is duplicated in this file (also row ${prev}).`,
        });
      } else {
        fileSkus.set(skuKey(sku), rowNumber);
      }
    }
    if (barcodeRaw) {
      const prev = fileBarcodes.get(barcodeKey(barcodeRaw));
      if (prev) {
        rowIssues.push({
          rowNumber,
          field: "barcode",
          message: `Barcode is duplicated in this file (also row ${prev}).`,
        });
      } else {
        fileBarcodes.set(barcodeKey(barcodeRaw), rowNumber);
      }
    }

    const existing = sku ? existingBySku.get(skuKey(sku)) : undefined;
    if (barcodeRaw && !existing) {
      const clash = existingByBarcode.get(barcodeKey(barcodeRaw));
      if (clash) {
        rowIssues.push({
          rowNumber,
          field: "barcode",
          message: `Barcode is already assigned to SKU ${clash.sku}.`,
        });
      }
    }

    if (expiryDate && !stripCell(tracksRaw)) {
      tracksExpiry = true;
    }
    if (!existing && tracksExpiry && quantity > 0 && !expiryDate) {
      rowIssues.push({
        rowNumber,
        field: "expiryDate",
        message:
          "Expiry date (YYYY-MM-DD) is required when tracking expiry on opening stock, or set quantity to 0.",
      });
    }

    if (rowIssues.length > 0) {
      issues.push(...rowIssues);
      return;
    }

    const action: PreparedImportRow["action"] = existing ? "update" : "create";
    if (action === "create") {
      if (args.remainingCreates !== null && createsSoFar + 1 > args.remainingCreates) {
        issues.push({
          rowNumber,
          field: "file",
          message: "Product limit reached. Upgrade to import more products, or skip new SKUs.",
        });
        return;
      }
      createsSoFar += 1;
    }

    rows.push({
      rowNumber,
      action,
      name,
      sku,
      barcode: barcodeRaw || undefined,
      category,
      costPrice: costPrice!,
      sellingPrice: sellingPrice!,
      quantity,
      unit: unitRaw || "units",
      lowStockThreshold,
      description: descriptionRaw || undefined,
      status: status ?? "active",
      tracksExpiry,
      expiryAlertDays,
      expiryDate,
      existingId: existing?.id,
      quantityIgnoredOnUpdate: action === "update" && quantity > 0,
    });
  });

  return {
    rows,
    issues,
    createCount: rows.filter((r) => r.action === "create").length,
    updateCount: rows.filter((r) => r.action === "update").length,
    skipCount: rows.filter((r) => r.action === "skip").length,
    invalidCount: issues.filter((i) => i.rowNumber > 0).length,
  };
}
