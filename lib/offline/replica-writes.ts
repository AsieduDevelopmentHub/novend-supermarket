import { branchStockId, applyLocalBranchStockChange, getSellableQuantity } from "./branch-stock";
import { getMeta, getOfflineDb, META_KEYS, newClientId } from "./db";
import { pendingOutboundTransferQuantities, transferStockKey } from "./pending-transfers";
import { enqueueOutbox, withMirrorOnly } from "./outbox";
import { notifyReplicaChanged } from "./replica-events";
import { putProductImage, deleteProductImage } from "./image-cache";
import { BARCODE_ALREADY_ASSIGNED, barcodesEqual, normalizeBarcodeInput } from "./barcode-lookup";
import { assertFeatureEnabled, assertLocalCapacity, assertLocalWriteAllowed } from "./license-guard";
import { loadCloudPolicy } from "./cloud-policy";
import { loadProductImagesPolicyCache } from "./product-images-policy";
import { assertProductImageUploadsEnabled } from "@/convex/shared/productImagesPolicy";
import { nextCatalogPrices } from "@/lib/wholesale/purchase-prices";
import { DEFAULT_EXPIRY_ALERT_DAYS, lotStatus } from "@/lib/expiry";
import type {
  AdjustStockPayload,
  CreateCategoryPayload,
  CreateExpensePayload,
  CreateUserPayload,
  PayCommissionPayload,
  PaySalaryPayload,
  RecordWholesalePurchasePayload,
  RemoveExpensePayload,
  TransferStockPayload,
  UpdateLotExpiryPayload,
  UpsertBranchPayload,
  UpsertCustomerPayload,
  UpsertProductPayload,
  UpsertStaffCompensationPayload,
  UpsertSupplierPayload,
  WholesaleTransferPayload,
} from "./types";
import { roundMoney } from "@/lib/currency";
import {
  assertPayPeriodKey,
  computeCommissionEarned,
  currentPayPeriodKey,
  periodBounds,
} from "@/convex/shared/payroll";

const QUEUED_TOAST = "Saved on this device. We'll sync when you're back online.";

/**
 * Write Dexie immediately. When online on full_sync, outbox flush updates Convex.
 * On package/local modes outbox flush is disabled — apply Dexie without queueing,
 * then call Convex directly so the cloud clone stays aligned (Inventory vs Sales).
 */
export async function persistBusinessWrite(args: {
  online: boolean;
  remote: () => Promise<unknown>;
  local: () => Promise<unknown>;
}): Promise<"remote" | "queued"> {
  await assertLocalWriteAllowed();
  if (args.online) {
    const policy = await loadCloudPolicy();
    if (!policy.shouldQueueRealtimeSync()) {
      await withMirrorOnly(() => args.local());
      try {
        await args.remote();
        notifyReplicaChanged({ flush: false });
        return "remote";
      } catch {
        // Dexie already has the write; lists prefer Dexie on package modes.
        notifyReplicaChanged({ flush: false });
        return "queued";
      }
    }
  }
  await args.local();
  notifyReplicaChanged({ flush: args.online });
  return args.online ? "remote" : "queued";
}

export function queuedSaveMessage(kind: "remote" | "queued", live: string) {
  return kind === "queued" ? QUEUED_TOAST : live;
}

export async function queueUpsertSupplier(
  payload: Omit<UpsertSupplierPayload, "localId"> & { localId?: string },
) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const localId = payload.serverId ?? payload.localId ?? newClientId("local");
  const row: UpsertSupplierPayload = { ...payload, localId };
  await db.suppliers.put({
    id: localId,
    name: row.name,
    contactName: row.contactName ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    address: row.address ?? null,
    notes: row.notes ?? null,
    status: row.status ?? "active",
    createdAt: Date.now(),
  });
  await enqueueOutbox(db, "upsert_supplier", row);
  return localId;
}

export async function queueWholesalePurchase(
  payload: Omit<RecordWholesalePurchasePayload, "localId">,
) {
  await assertLocalWriteAllowed();
  await assertFeatureEnabled("inventory.wholesale");
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const localId = newClientId("local");
  const supplier = await db.suppliers.get(payload.supplierId);
  const totalCost = payload.items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
  const itemCount = payload.items.reduce((sum, item) => sum + item.quantity, 0);
  const lineItems = [];
  for (const item of payload.items) {
    const rowProduct = await db.products.get(item.productId);
    const prices = nextCatalogPrices({
      unitCost: item.unitCost,
      sellingPrice: item.sellingPrice,
      currentSelling: rowProduct?.sellingPrice ?? item.unitCost,
    });
    lineItems.push({
      productId: item.productId,
      productName: rowProduct?.name ?? "Product",
      quantity: item.quantity,
      unitCost: item.unitCost,
      unitSellingPrice: prices.sellingPrice,
      lineTotal: item.unitCost * item.quantity,
    });
    if (rowProduct) {
      await db.products.put({
        ...rowProduct,
        costPrice: prices.costPrice,
        sellingPrice: prices.sellingPrice,
        updatedAt: Date.now(),
      });
    }
    const existing = (await db.wholesaleStock.toArray()).find(
      (row) => row.productId === item.productId,
    );
    const nextQty = (existing?.quantity ?? 0) + item.quantity;
    await db.wholesaleStock.put({
      id: existing?.id ?? newClientId("local"),
      productId: item.productId,
      name: rowProduct?.name ?? existing?.name ?? "Product",
      sku: rowProduct?.sku ?? existing?.sku ?? "",
      unit: rowProduct?.unit ?? existing?.unit ?? "",
      costPrice: prices.costPrice,
      sellingPrice: prices.sellingPrice,
      quantity: nextQty,
      tracksExpiry: rowProduct?.tracksExpiry ?? existing?.tracksExpiry ?? false,
    });
  }
  await db.wholesalePurchases.put({
    id: localId,
    reference: `OFF-${localId.slice(-6).toUpperCase()}`,
    invoiceNumber: payload.invoiceNumber ?? null,
    supplierId: payload.supplierId,
    supplierName: supplier?.name ?? "Supplier",
    purchasedAt: payload.purchasedAt,
    itemCount,
    totalCost,
    notes: payload.notes ?? null,
    status: "completed",
    items: lineItems,
  });
  await enqueueOutbox(db, "record_wholesale_purchase", {
    ...payload,
    localId,
  } satisfies RecordWholesalePurchasePayload);
}

export async function queueWholesaleTransfer(payload: Omit<WholesaleTransferPayload, "localId">) {
  await assertLocalWriteAllowed();
  await assertFeatureEnabled("inventory.wholesale");
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const localId = newClientId("local");
  const product = await db.products.get(payload.productId);
  const branch = await db.branches.get(payload.branchId);
  const stock = (await db.wholesaleStock.toArray()).find(
    (row) => row.productId === payload.productId,
  );
  if (stock) {
    const next = stock.quantity - payload.quantity;
    if (next < 0) throw new Error("Insufficient wholesale stock");
    await db.wholesaleStock.put({ ...stock, quantity: next });
  }
  if (product) {
    await db.products.put({
      ...product,
      stockQuantity: product.stockQuantity + payload.quantity,
      sellableQuantity: (product.sellableQuantity ?? product.stockQuantity) + payload.quantity,
      updatedAt: Date.now(),
    });
  }
  const destStockId = branchStockId(payload.branchId, payload.productId);
  const destStock = await db.branchStock.get(destStockId);
  if (destStock) {
    await db.branchStock.put({
      ...destStock,
      quantity: destStock.quantity + payload.quantity,
      sellableQuantity: destStock.sellableQuantity + payload.quantity,
      updatedAt: Date.now(),
    });
  } else {
    await db.branchStock.put({
      id: destStockId,
      branchId: payload.branchId,
      productId: payload.productId,
      quantity: payload.quantity,
      sellableQuantity: payload.quantity,
      updatedAt: Date.now(),
    });
  }
  await db.wholesaleTransfers.put({
    id: localId,
    productName: product?.name ?? "Product",
    branchName: branch?.name ?? "Branch",
    quantity: payload.quantity,
    note: null,
    createdAt: Date.now(),
  });
  await enqueueOutbox(db, "wholesale_transfer", {
    ...payload,
    localId,
  } satisfies WholesaleTransferPayload);
}

export async function queueAdjustStock(payload: AdjustStockPayload) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const product = await db.products.get(payload.productId);
  const branchId = payload.branchId ?? (await getMeta(db, META_KEYS.profileBranchId));
  if (!branchId) {
    throw new Error("Select a branch for this adjustment");
  }
  if (product) {
    const hadBranchRow = Boolean(
      await db.branchStock.get(branchStockId(branchId, payload.productId)),
    );
    await applyLocalBranchStockChange(
      db,
      branchId,
      payload.productId,
      payload.quantityChange,
      product,
    );
    // branchStock rows do not update catalog totals — bump products for org-wide KPIs.
    if (hadBranchRow) {
      const refreshed = (await db.products.get(payload.productId)) ?? product;
      const next = refreshed.stockQuantity + payload.quantityChange;
      if (next < 0) throw new Error("Inventory cannot become negative");
      await db.products.put({
        ...refreshed,
        stockQuantity: next,
        sellableQuantity: Math.max(
          0,
          (refreshed.sellableQuantity ?? refreshed.stockQuantity) + payload.quantityChange,
        ),
        updatedAt: Date.now(),
      });
    }
  }
  await enqueueOutbox(db, "adjust_stock", {
    ...payload,
    branchId,
    clientOperationId: payload.clientOperationId ?? newClientId("op"),
  });
}

export async function queueUpdateLotExpiry(payload: UpdateLotExpiryPayload) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const lot = await db.lots.get(payload.lotId).catch(() => undefined);
  if (lot && lot.quantity <= 0) throw new Error("This lot has no stock left");

  const nextDate = payload.expiryDate;
  if (lot && nextDate !== lot.expiryDate) {
    const sameDate = (await db.lots.where("productId").equals(lot.productId).toArray()).find(
      (row) =>
        row.id !== lot.id &&
        row.branchId === lot.branchId &&
        row.expiryDate === nextDate &&
        row.quantity > 0,
    );
    if (sameDate) {
      await db.lots.put({
        ...sameDate,
        quantity: sameDate.quantity + lot.quantity,
      });
      await db.lots.delete(lot.id);
    } else {
      await db.lots.put({
        ...lot,
        expiryDate: nextDate,
        lotCode: !lot.lotCode || lot.lotCode === lot.expiryDate ? nextDate : lot.lotCode,
      });
    }
    const remaining = (await db.lots.where("productId").equals(lot.productId).toArray()).filter(
      (row) => row.quantity > 0,
    );
    const product = await db.products.get(lot.productId);
    if (product) {
      const nearest = [...remaining.map((row) => row.expiryDate)].sort()[0] ?? null;
      const alertDays = product.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS;
      const status = nearest ? lotStatus(nearest, alertDays) : "ok";
      await db.products.put({
        ...product,
        nearestExpiry: nearest,
        isExpired: status === "expired",
        isExpiring: status === "expiring",
        updatedAt: Date.now(),
      });
    }
  }

  await enqueueOutbox(db, "update_lot_expiry", {
    ...payload,
    clientOperationId: payload.clientOperationId ?? newClientId(),
  });
}

export async function queueTransferStock(payload: TransferStockPayload) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  if (payload.fromBranchId === payload.toBranchId) {
    throw new Error("Choose two different branches");
  }
  if (!Number.isInteger(payload.quantity) || payload.quantity <= 0) {
    throw new Error("Quantity must be a positive integer");
  }

  const pending = await pendingOutboundTransferQuantities(db);
  const key = transferStockKey(payload.fromBranchId, payload.productId);
  const reserved = pending.get(key) ?? 0;
  const available = await getSellableQuantity(db, payload.fromBranchId, payload.productId);
  if (available - reserved < payload.quantity) {
    throw new Error("Insufficient stock at source branch");
  }

  await enqueueOutbox(db, "transfer_stock", {
    ...payload,
    sourceStockSnapshot: available,
    clientOperationId: payload.clientOperationId ?? newClientId("op"),
  });
}

export async function queueUpsertCustomer(
  payload: Omit<UpsertCustomerPayload, "localId"> & { localId?: string },
) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const localId = payload.serverId ?? payload.localId ?? newClientId("local");
  const existing = await db.customers.get(localId);
  await db.customers.put({
    id: localId,
    name: payload.name,
    phone: payload.phone ?? null,
    email: payload.email ?? null,
    notes: payload.notes ?? null,
    status: payload.status ?? "active",
    purchaseCount: existing?.purchaseCount ?? 0,
    lastPurchaseAt: existing?.lastPurchaseAt ?? null,
    lastPurchaseTotal: existing?.lastPurchaseTotal ?? null,
    lastInvoiceNumber: existing?.lastInvoiceNumber ?? null,
    updatedAt: Date.now(),
  });
  await enqueueOutbox(db, "upsert_customer", {
    ...payload,
    localId,
  } satisfies UpsertCustomerPayload);
  return localId;
}

export async function queueCreateExpense(payload: Omit<CreateExpensePayload, "localId">) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const localId = newClientId("local");
  const branch = await db.branches.get(payload.branchId);
  await db.expenses.put({
    id: localId,
    amount: payload.amount,
    category: payload.category,
    occurredAt: payload.occurredAt,
    description: payload.description ?? null,
    recordedByName: "You",
    branchId: payload.branchId,
    branchName: branch?.name ?? null,
  });
  await enqueueOutbox(db, "create_expense", { ...payload, localId } satisfies CreateExpensePayload);
}

export async function queueRemoveExpense(payload: RemoveExpensePayload) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  await db.expenses.delete(payload.expenseId);
  await enqueueOutbox(db, "remove_expense", payload);
}

export async function queueUpdateProfile(payload: { name?: string; phone?: string }) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  await enqueueOutbox(db, "update_profile", payload);
}

/**
 * Staff logins require Convex Auth. Passwords must never sit in the Dexie outbox
 * (see docs/architecture/OFFLINE_SYNC.md — "Creating a new login").
 * Call `users.createUserAccount` while online instead.
 */
export async function queueCreateUser(_payload: Omit<CreateUserPayload, "localId">) {
  await assertLocalWriteAllowed();
  throw new Error(
    "Connect to the internet to create user accounts. Login passwords cannot be saved for offline sync.",
  );
}

export async function queueCreateCategory(name: string, options?: { notify?: boolean }) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const localId = newClientId("local");
  const trimmed = name.trim();
  await db.categories.put({
    id: localId,
    name: trimmed,
    slug: trimmed.toLowerCase().replace(/\s+/g, "-"),
    isActive: true,
  });
  await enqueueOutbox(
    db,
    "create_category",
    {
      localId,
      name: trimmed,
    } satisfies CreateCategoryPayload,
    undefined,
    { notify: options?.notify },
  );
  return localId;
}

/** Reuse an active category with the same name (case-insensitive). Prefer a server id. */
export function matchActiveCategoryByName(
  rows: Array<{ id: string; name: string; isActive?: boolean }>,
  name: string,
): string | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  const matches = rows.filter(
    (row) => row.isActive !== false && row.name.trim().toLowerCase() === key,
  );
  const server = matches.find((row) => !row.id.startsWith("local_"));
  return server?.id ?? matches[0]?.id ?? null;
}

/** Map a local_* category onto a synced row with the same name, if any. */
export function resolveLocalCategoryToServerId(
  rows: Array<{ id: string; name: string; isActive?: boolean }>,
  categoryId: string,
  fallbackName?: string | null,
): string | null {
  if (!categoryId.startsWith("local_")) return categoryId;
  const local = rows.find((row) => row.id === categoryId);
  const name = local?.name ?? fallbackName?.trim();
  if (!name) return null;
  return matchActiveCategoryByName(
    rows.filter((row) => !row.id.startsWith("local_")),
    name,
  );
}

/**
 * Product create/edit: a typed "new category" name becomes the product's
 * category without a separate Add click.
 */
export async function resolveCategoryIdForProduct(input: {
  selectedId: string;
  typedName: string;
}): Promise<string> {
  const typed = input.typedName.trim();
  if (typed) {
    const db = await getOfflineDb();
    if (db) {
      const existingId = matchActiveCategoryByName(await db.categories.toArray(), typed);
      if (existingId) return existingId;
    }
    return queueCreateCategory(typed);
  }
  if (!input.selectedId.trim()) {
    throw new Error("Select a category");
  }
  return input.selectedId;
}

async function resolveCategoryNameForProduct(
  db: NonNullable<Awaited<ReturnType<typeof getOfflineDb>>>,
  categoryId: string,
  explicitName?: string | null,
  existingName?: string | null,
): Promise<string> {
  if (explicitName?.trim()) return explicitName.trim();
  const row = await db.categories.get(categoryId);
  if (row?.name) return row.name;
  if (existingName?.trim()) return existingName.trim();
  return "Uncategorized";
}

export async function queueUpsertProduct(
  payload: Omit<UpsertProductPayload, "localId"> & { localId?: string; imageBlob?: Blob },
  options?: { notify?: boolean },
) {
  await assertLocalWriteAllowed();
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const localId = payload.serverId ?? payload.localId ?? newClientId("local");
  const existing = await db.products.get(localId);
  const categoryName = await resolveCategoryNameForProduct(
    db,
    payload.categoryId,
    payload.categoryName,
    existing?.categoryName,
  );
  const barcode = payload.barcode ? normalizeBarcodeInput(payload.barcode) : undefined;
  if (barcode && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(barcode)) {
    throw new Error("Barcode may only contain letters, numbers, dots, hyphens, and underscores");
  }
  if (barcode) {
    const clash = (await db.products.toArray()).find(
      (row) => row.id !== localId && barcodesEqual(row.barcode, barcode),
    );
    if (clash) throw new Error(BARCODE_ALREADY_ASSIGNED);
  }
  const isCreate = !existing;
  // Enforce the plan product limit locally before queueing an offline create;
  // Convex re-checks on sync. Updates never hit the create limit.
  if (isCreate) await assertLocalCapacity("products");
  const tracksExpiry = payload.tracksExpiry === true;
  const applyStockOnUpdate =
    !isCreate && payload.applyStockQuantity === true && existing !== undefined;
  if (applyStockOnUpdate) {
    await assertFeatureEnabled("products.editStock");
    if (tracksExpiry || existing.tracksExpiry === true) {
      throw new Error("Use Inventory or Expiry lots to change stock on dated products");
    }
  }
  const nextStock = Math.max(0, Math.floor(payload.stockQuantity));
  const stockQuantity = isCreate
    ? nextStock
    : applyStockOnUpdate
      ? nextStock
      : (existing?.stockQuantity ?? 0);
  const openingQty = Math.max(0, Math.floor(isCreate ? stockQuantity : 0));
  const alertDays = payload.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS;
  const expiryStatus =
    tracksExpiry && payload.expiryDate ? lotStatus(payload.expiryDate, alertDays) : "ok";
  const { imageBlob, ...rest } = payload;
  const clearImage = payload.clearImage === true;
  if (imageBlob && !clearImage) {
    assertProductImageUploadsEnabled(await loadProductImagesPolicyCache());
  }
  await db.products.put({
    id: localId,
    name: payload.name,
    sku: payload.sku,
    barcode: barcode || null,
    categoryId: payload.categoryId,
    categoryName,
    sellingPrice: payload.sellingPrice,
    costPrice: payload.costPrice,
    stockQuantity,
    sellableQuantity: isCreate
      ? stockQuantity
      : applyStockOnUpdate
        ? stockQuantity
        : (existing.sellableQuantity ?? stockQuantity),
    unit: payload.unit,
    sellUnits: payload.sellUnits ?? existing?.sellUnits ?? null,
    pricingMode: payload.pricingMode ?? existing?.pricingMode ?? null,
    lowStockThreshold: payload.lowStockThreshold,
    status: payload.status,
    description: payload.description ?? existing?.description ?? null,
    imageUrl: clearImage ? null : (existing?.imageUrl ?? null),
    tracksExpiry: payload.tracksExpiry,
    tracksInventory: payload.tracksInventory,
    expiryAlertDays: payload.expiryAlertDays ?? null,
    nearestExpiry: payload.expiryDate ?? existing?.nearestExpiry ?? null,
    isExpired: expiryStatus === "expired",
    isExpiring: expiryStatus === "expiring",
    updatedAt: Date.now(),
  });
  if (isCreate && payload.branchId) {
    if (openingQty > 0) {
      const isExpiring = expiryStatus === "expiring";
      await db.branchStock.put({
        id: branchStockId(payload.branchId, localId),
        branchId: payload.branchId,
        productId: localId,
        quantity: openingQty,
        sellableQuantity: openingQty,
        isExpiring,
        updatedAt: Date.now(),
      });
      if (tracksExpiry && payload.expiryDate) {
        await db.lots.put({
          id: newClientId("lot"),
          productId: localId,
          branchId: payload.branchId,
          quantity: openingQty,
          expiryDate: payload.expiryDate,
          lotCode: payload.expiryDate,
          receivedAt: Date.now(),
        });
      }
    } else {
      await db.branchStock.put({
        id: branchStockId(payload.branchId, localId),
        branchId: payload.branchId,
        productId: localId,
        quantity: 0,
        sellableQuantity: 0,
        updatedAt: Date.now(),
      });
    }
  } else if (applyStockOnUpdate) {
    const branchId = payload.branchId ?? (await getMeta(db, META_KEYS.profileBranchId));
    if (!branchId) {
      throw new Error("Select a branch before editing stock");
    }
    const rowId = branchStockId(branchId, localId);
    const existingRow = await db.branchStock.get(rowId);
    await db.branchStock.put({
      id: rowId,
      branchId,
      productId: localId,
      quantity: stockQuantity,
      sellableQuantity: stockQuantity,
      isExpiring: existingRow?.isExpiring,
      updatedAt: Date.now(),
    });
  }
  if (clearImage) {
    await deleteProductImage(localId);
  } else if (imageBlob) {
    await putProductImage({
      productId: localId,
      blob: imageBlob,
      mimeType: imageBlob.type || "image/jpeg",
    });
  }
  await enqueueOutbox(
    db,
    "upsert_product",
    {
      ...rest,
      localId,
      stockQuantity: isCreate ? payload.stockQuantity : stockQuantity,
      applyStockQuantity: applyStockOnUpdate || undefined,
      hasLocalImage: clearImage ? false : Boolean(imageBlob) || payload.hasLocalImage,
      clearImage: clearImage || undefined,
    } satisfies UpsertProductPayload,
    undefined,
    { notify: options?.notify },
  );
  return localId;
}

export async function queueUpsertBranch(
  payload: Omit<UpsertBranchPayload, "localId"> & { localId?: string },
) {
  await assertLocalWriteAllowed();
  await assertFeatureEnabled("branches.multiBranch");
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const code = payload.code.trim().toUpperCase().replace(/\s+/g, "_");
  const localId = payload.serverId ?? payload.localId ?? newClientId("local");
  const existing = await db.branches.get(localId);
  if (!existing) await assertLocalCapacity("branches");
  const clash = (await db.branches.toArray()).find(
    (row) => row.code === code && row.id !== localId,
  );
  if (clash) throw new Error("Branch code already exists");
  await db.branches.put({
    id: localId,
    name: payload.name.trim(),
    code,
    address: payload.address?.trim() || null,
    phone: payload.phone?.trim() || null,
    status: payload.status ?? "active",
  });
  await enqueueOutbox(db, "upsert_branch", {
    ...payload,
    localId,
    code,
    status: payload.status ?? "active",
  } satisfies UpsertBranchPayload);
  return localId;
}

export async function queueUpsertStaffCompensation(payload: UpsertStaffCompensationPayload) {
  await assertLocalWriteAllowed();
  await assertFeatureEnabled("staff.compensation");
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const existing = await db.staffCompensation.get(payload.profileId);
  const row = {
    id: payload.profileId,
    salaryAmount:
      payload.salaryAmount === undefined
        ? (existing?.salaryAmount ?? null)
        : roundMoney(payload.salaryAmount),
    salaryFrequency: payload.salaryFrequency,
    commissionRate:
      payload.commissionRate === undefined
        ? (existing?.commissionRate ?? null)
        : roundMoney(payload.commissionRate),
    commissionBasis: payload.commissionBasis,
    updatedAt: Date.now(),
  };
  await db.staffCompensation.put(row);
  await enqueueOutbox(db, "upsert_staff_compensation", payload);
}

async function paidPayrollExpenseExists(
  db: NonNullable<Awaited<ReturnType<typeof getOfflineDb>>>,
  profileId: string,
  sourceKind: "salary" | "commission",
  payPeriodKey: string,
) {
  const rows = await db.expenses
    .filter(
      (row) =>
        row.beneficiaryProfileId === profileId &&
        row.sourceKind === sourceKind &&
        row.payPeriodKey === payPeriodKey &&
        row.paymentStatus !== "void",
    )
    .toArray();
  return rows.length > 0;
}

export async function queuePaySalary(payload: PaySalaryPayload) {
  await assertLocalWriteAllowed();
  await assertFeatureEnabled("staff.compensation");
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const user = await db.users.get(payload.profileId);
  if (!user?.branchId) throw new Error("This user has no branch assignment");
  const compensation = await db.staffCompensation.get(payload.profileId);
  const amount = compensation?.salaryAmount ?? 0;
  if (!amount || amount <= 0) {
    throw new Error("Set a salary amount before recording a payment.");
  }
  const frequency = compensation?.salaryFrequency ?? "monthly";
  const payPeriodKey = assertPayPeriodKey(payload.payPeriodKey, frequency);
  if (await paidPayrollExpenseExists(db, payload.profileId, "salary", payPeriodKey)) {
    throw new Error(`Salary for ${payPeriodKey} is already recorded.`);
  }
  const { end } = periodBounds(payPeriodKey);
  const branch = await db.branches.get(user.branchId);
  const localId = newClientId("local");
  await db.expenses.put({
    id: localId,
    amount: roundMoney(amount),
    category: "salaries",
    occurredAt: Math.min(end, Date.now()),
    description: `Salary ${payPeriodKey} — ${user.name}`,
    recordedByName: "You",
    recordedByUserId: (await getMeta(db, META_KEYS.profileUserId)) ?? null,
    branchId: user.branchId,
    branchName: branch?.name ?? null,
    beneficiaryProfileId: payload.profileId,
    payPeriodKey,
    paymentStatus: "paid",
    sourceKind: "salary",
  });
  await enqueueOutbox(db, "pay_salary", {
    ...payload,
    payPeriodKey,
    localExpenseId: localId,
    clientOperationId: payload.clientOperationId ?? newClientId("pay_salary"),
  });
  return localId;
}

export async function queuePayCommission(payload: PayCommissionPayload) {
  await assertLocalWriteAllowed();
  await assertFeatureEnabled("staff.compensation");
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const user = await db.users.get(payload.profileId);
  if (!user?.branchId) throw new Error("This user has no branch assignment");
  const compensation = await db.staffCompensation.get(payload.profileId);
  const frequency = compensation?.salaryFrequency ?? "monthly";
  const payPeriodKey = assertPayPeriodKey(payload.payPeriodKey, frequency);
  const { start, end } = periodBounds(payPeriodKey);
  const rate = compensation?.commissionRate ?? 0;
  if (!rate || rate <= 0) {
    throw new Error("Set a commission rate before recording a payment.");
  }
  const sales = (await db.orders.toArray()).filter(
    (row) => row.cashierId === user.userId && row.completedAt >= start && row.completedAt <= end,
  );
  const localSales = (await db.localSales.toArray()).filter(
    (row) =>
      row.cashierId === user.userId &&
      row.syncStatus !== "synced" &&
      row.completedAt >= start &&
      row.completedAt <= end,
  );
  const grossSales = roundMoney([...sales, ...localSales].reduce((sum, row) => sum + row.total, 0));
  const saleIds = new Set([...sales.map((row) => row.id), ...localSales.map((row) => row.id)]);
  const returns = (await db.returns.toArray()).filter(
    (row) => saleIds.has(row.saleId) && row.completedAt >= start && row.completedAt <= end,
  );
  const refundTotal = roundMoney(returns.reduce((sum, row) => sum + row.refundAmount, 0));
  const netSales = roundMoney(Math.max(0, grossSales - refundTotal));
  const earned = computeCommissionEarned({
    netSales,
    grossSales,
    rate,
    basis: compensation?.commissionBasis ?? "net",
  });
  const paidRows = await db.expenses
    .filter(
      (row) =>
        row.beneficiaryProfileId === payload.profileId &&
        row.sourceKind === "commission" &&
        row.payPeriodKey === payPeriodKey &&
        row.paymentStatus !== "void",
    )
    .toArray();
  const alreadyPaid = roundMoney(paidRows.reduce((sum, row) => sum + row.amount, 0));
  const outstanding = roundMoney(Math.max(0, earned - alreadyPaid));
  if (outstanding <= 0) {
    throw new Error(`No outstanding commission for ${payPeriodKey}.`);
  }
  const branch = await db.branches.get(user.branchId);
  const localId = newClientId("local");
  await db.expenses.put({
    id: localId,
    amount: outstanding,
    category: "commissions",
    occurredAt: Math.min(end, Date.now()),
    description: `Commission ${payPeriodKey} — ${user.name}`,
    recordedByName: "You",
    recordedByUserId: (await getMeta(db, META_KEYS.profileUserId)) ?? null,
    branchId: user.branchId,
    branchName: branch?.name ?? null,
    beneficiaryProfileId: payload.profileId,
    payPeriodKey,
    paymentStatus: "paid",
    sourceKind: "commission",
  });
  await enqueueOutbox(db, "pay_commission", {
    ...payload,
    payPeriodKey,
    localExpenseId: localId,
    clientOperationId: payload.clientOperationId ?? newClientId("pay_commission"),
  });
  return localId;
}
