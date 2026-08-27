import { branchStockId } from "./branch-stock";
import { getMeta, getOfflineDb, META_KEYS, newClientId } from "./db";
import { enqueueOutbox } from "./outbox";
import { notifyReplicaChanged } from "./replica-events";
import { putProductImage } from "./image-cache";
import { BARCODE_ALREADY_ASSIGNED, barcodesEqual, normalizeBarcodeInput } from "./barcode-lookup";
import { nextCatalogPrices } from "@/lib/wholesale/purchase-prices";
import type {
  AdjustStockPayload,
  CreateCategoryPayload,
  CreateExpensePayload,
  CreateUserPayload,
  RecordWholesalePurchasePayload,
  RemoveExpensePayload,
  TransferStockPayload,
  UpsertBranchPayload,
  UpsertCustomerPayload,
  UpsertProductPayload,
  UpsertSupplierPayload,
  WholesaleTransferPayload,
} from "./types";

const QUEUED_TOAST = "Saved on this device. We'll sync when you're back online.";

/**
 * Write Dexie immediately and return. Cloud sync is background work.
 * `remote` is unused — kept so call sites stay explicit about the Convex mutation.
 */
export async function persistBusinessWrite(args: {
  online: boolean;
  remote: () => Promise<unknown>;
  local: () => Promise<unknown>;
}): Promise<"remote" | "queued"> {
  void args.remote;
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
  if (product) {
    const next = product.stockQuantity + payload.quantityChange;
    if (next < 0) throw new Error("Inventory cannot become negative");
    await db.products.put({
      ...product,
      stockQuantity: next,
      sellableQuantity: Math.max(
        0,
        (product.sellableQuantity ?? product.stockQuantity) + payload.quantityChange,
      ),
      updatedAt: Date.now(),
    });
  }
  await enqueueOutbox(db, "adjust_stock", payload);
}

export async function queueTransferStock(payload: TransferStockPayload) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const assignedBranchId = await getMeta(db, META_KEYS.profileBranchId);
  const product = await db.products.get(payload.productId);
  if (product && assignedBranchId) {
    let delta = 0;
    if (payload.fromBranchId === assignedBranchId) delta -= payload.quantity;
    if (payload.toBranchId === assignedBranchId) delta += payload.quantity;
    if (delta !== 0) {
      const next = product.stockQuantity + delta;
      if (next < 0) throw new Error("Inventory cannot become negative");
      await db.products.put({
        ...product,
        stockQuantity: next,
        sellableQuantity: Math.max(0, (product.sellableQuantity ?? product.stockQuantity) + delta),
        updatedAt: Date.now(),
      });
    }
  }
  await enqueueOutbox(db, "transfer_stock", payload);
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

export async function queueCreateUser(payload: Omit<CreateUserPayload, "localId">) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const localId = newClientId("local");
  const branch = await db.branches.get(payload.branchId);
  await db.users.put({
    id: localId,
    userId: localId,
    name: payload.name,
    role: payload.role,
    branch: branch?.name ?? "Branch",
    branchId: payload.branchId,
    phone: payload.phone ?? null,
    status: "active",
    email: payload.email,
    imageUrl: null,
    presence: "offline",
    lastSeenAt: null,
    lastLoginAt: null,
    lastDevice: null,
  });
  await enqueueOutbox(db, "create_user", { ...payload, localId } satisfies CreateUserPayload);
  return localId;
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

export async function queueUpsertProduct(
  payload: Omit<UpsertProductPayload, "localId"> & { localId?: string; imageBlob?: Blob },
  options?: { notify?: boolean },
) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const localId = payload.serverId ?? payload.localId ?? newClientId("local");
  const category = await db.categories.get(payload.categoryId);
  const existing = await db.products.get(localId);
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
  const stockQuantity = isCreate ? payload.stockQuantity : (existing.stockQuantity ?? 0);
  const { imageBlob, ...rest } = payload;
  await db.products.put({
    id: localId,
    name: payload.name,
    sku: payload.sku,
    barcode: barcode || null,
    categoryId: payload.categoryId,
    categoryName: category?.name ?? existing?.categoryName ?? "Uncategorized",
    sellingPrice: payload.sellingPrice,
    costPrice: payload.costPrice,
    stockQuantity,
    sellableQuantity: isCreate ? stockQuantity : (existing.sellableQuantity ?? stockQuantity),
    unit: payload.unit,
    lowStockThreshold: payload.lowStockThreshold,
    status: payload.status,
    description: payload.description ?? existing?.description ?? null,
    imageUrl: existing?.imageUrl ?? null,
    tracksExpiry: payload.tracksExpiry,
    expiryAlertDays: payload.expiryAlertDays ?? null,
    nearestExpiry: payload.expiryDate ?? existing?.nearestExpiry ?? null,
    isExpired: existing?.isExpired ?? false,
    isExpiring: existing?.isExpiring ?? false,
    updatedAt: Date.now(),
  });
  if (isCreate && payload.branchId) {
    const qty = Math.max(0, Math.floor(payload.stockQuantity));
    await db.branchStock.put({
      id: branchStockId(payload.branchId, localId),
      branchId: payload.branchId,
      productId: localId,
      quantity: qty,
      sellableQuantity: qty,
      updatedAt: Date.now(),
    });
  }
  if (imageBlob) {
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
      stockQuantity: isCreate ? payload.stockQuantity : 0,
      hasLocalImage: Boolean(imageBlob) || payload.hasLocalImage,
    } satisfies UpsertProductPayload,
    undefined,
    { notify: options?.notify },
  );
  return localId;
}

export async function queueUpsertBranch(
  payload: Omit<UpsertBranchPayload, "localId"> & { localId?: string },
) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const code = payload.code.trim().toUpperCase().replace(/\s+/g, "_");
  const localId = payload.serverId ?? payload.localId ?? newClientId("local");
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
