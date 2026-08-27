import type { ReceiptPayload } from "@/features/receipts/types";
import {
  getMeta,
  getOfflineDb,
  META_KEYS,
  newClientId,
  nextProvisionalInvoice,
  type NovendOfflineDb,
} from "./db";
import { applyLocalBranchStockChange, getSellableQuantity } from "./branch-stock";
import { enqueueCompleteSale } from "./outbox";
import { notifyReplicaChanged } from "./replica-events";
import type {
  CompleteSaleOutboxPayload,
  LocalHeldSale,
  LocalSale,
  MirroredOrder,
  MirroredOrderItem,
  PrintSnapshot,
  LocalSaleItem,
} from "./types";

export type CartLineInput = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
};

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function stampPrintedInvoice(payload: unknown, invoiceNumber: string): unknown {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return { ...payload, invoiceNumber };
  }
  return payload;
}

async function loadPrintSnapshot(db: NovendOfflineDb): Promise<PrintSnapshot> {
  const raw = await getMeta(db, META_KEYS.printSnapshot);
  if (raw) {
    try {
      return JSON.parse(raw) as PrintSnapshot;
    } catch {
      /* fall through */
    }
  }
  return {
    business: {
      tradeName: "Novend",
      legalName: "Novend",
      address: "Accra, Ghana",
      phone: "",
      email: "",
      taxId: "",
    },
    template: {
      paperWidthMm: 80,
      showLogo: true,
      headerText: "Wholesale & Retail Distribution",
      footerText: "Thank you for your business",
      thankYouLine: "Goods sold are not returnable without receipt",
      showCashier: true,
      showCustomer: true,
      showPaymentMethod: true,
      showSku: false,
    },
  };
}

/** Apply a completed sale locally + enqueue outbox op. Receipt invoice is canonical. */
export async function completeSaleLocally(input: {
  items: CartLineInput[];
  discount: number;
  paymentMethod: "cash" | "card" | "mobile_money";
  customerId?: string;
  customerName?: string;
  customerPhone?: string | null;
  branchId?: string;
  localHeldSaleId?: string;
  serverHeldSaleId?: string;
}): Promise<{
  localSaleId: string;
  clientOperationId: string;
  invoiceNumber: string;
  total: number;
  receiptPayload: ReceiptPayload;
}> {
  const db = await getOfflineDb();
  if (!db) {
    throw new Error("Local database unavailable");
  }
  if (input.items.length === 0) {
    throw new Error("Cart is empty");
  }

  const cashierId = (await getMeta(db, META_KEYS.profileUserId)) ?? "unknown";
  const cashierName = (await getMeta(db, META_KEYS.profileName)) ?? "Cashier";
  const assignedBranchId = (await getMeta(db, META_KEYS.profileBranchId)) ?? undefined;
  const branchId = input.branchId ?? assignedBranchId;
  const branchName = (await getMeta(db, META_KEYS.profileBranchName)) ?? null;
  const print = await loadPrintSnapshot(db);
  const clientOperationId = newClientId("sale");
  const localSaleId = newClientId("lsale");
  const invoiceNumber = nextProvisionalInvoice();
  const completedAt = Date.now();

  const lines: LocalSaleItem[] = [];
  let subtotal = 0;
  let itemCount = 0;
  let receiptPayload: ReceiptPayload | null = null;
  let total = 0;

  await db.transaction(
    "rw",
    [
      db.products,
      db.branchStock,
      db.localSales,
      db.localSaleItems,
      db.localReceipts,
      db.outbox,
      db.heldSales,
    ],
    async () => {
      for (const item of input.items) {
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          throw new Error("Invalid quantity");
        }
        const product = await db.products.get(item.productId);
        if (!product || product.status !== "active") {
          throw new Error(`Product unavailable: ${item.name}`);
        }
        if (!branchId) {
          throw new Error("Branch is required to complete this sale offline");
        }
        const available = await getSellableQuantity(db, branchId, item.productId, product);
        if (available < item.quantity) {
          throw new Error(`Not enough stock for ${product.name}. Available: ${available}.`);
        }
        const gross = roundMoney(product.sellingPrice * item.quantity);
        if (!Number.isFinite(item.discount) || item.discount < 0 || item.discount - gross > 0.001) {
          throw new Error(
            item.discount < 0
              ? "Invalid line discount"
              : `Discount exceeds line total for ${product.name}`,
          );
        }
        const lineTotal = roundMoney(gross - item.discount);
        subtotal += lineTotal;
        itemCount += item.quantity;
        lines.push({
          id: newClientId("litem"),
          localSaleId,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: item.quantity,
          unitPrice: product.sellingPrice,
          unitCost: product.costPrice,
          discount: item.discount,
          lineTotal,
        });
        await applyLocalBranchStockChange(db, branchId, product.id, -item.quantity, product);
      }

      const cartDiscount = roundMoney(input.discount);
      if (!Number.isFinite(cartDiscount) || cartDiscount < 0) {
        throw new Error("Invalid cart discount");
      }
      if (cartDiscount - subtotal > 0.001) {
        throw new Error("Discount cannot exceed the sale subtotal");
      }
      total = Math.max(0, roundMoney(subtotal - cartDiscount));
      const customerName = input.customerName?.trim() || "Walk-in Customer";

      const sale: LocalSale = {
        id: localSaleId,
        clientOperationId,
        invoiceNumber,
        cashierId,
        cashierName,
        branchId,
        branchName,
        customerId: input.customerId,
        customerName,
        customerPhone: input.customerPhone ?? null,
        subtotal: roundMoney(subtotal),
        discount: cartDiscount,
        total,
        paymentMethod: input.paymentMethod,
        itemCount,
        completedAt,
        syncStatus: "pending",
      };

      await db.localSales.put(sale);
      await db.localSaleItems.bulkPut(lines);

      receiptPayload = {
        invoiceNumber,
        saleId: localSaleId,
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        itemCount,
        lines: lines.map((l) => ({
          productName: l.productName,
          sku: l.sku,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          lineTotal: l.lineTotal,
        })),
        paymentMethod: input.paymentMethod,
        completedAt,
        customerName,
        customerPhone: input.customerPhone ?? null,
        customerId: input.customerId ?? null,
        cashierName,
        business: print.business,
        template: print.template,
      };

      await db.localReceipts.put({
        id: newClientId("lrcpt"),
        localSaleId,
        invoiceNumber,
        payloadJson: JSON.stringify(receiptPayload),
        createdAt: completedAt,
      });

      const payload: CompleteSaleOutboxPayload = {
        localSaleId,
        invoiceNumber,
        customerId: input.customerId,
        customerName,
        items: input.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          discount: i.discount,
        })),
        discount: cartDiscount,
        paymentMethod: input.paymentMethod,
        branchId,
        localHeldSaleId: input.localHeldSaleId,
        serverHeldSaleId: input.serverHeldSaleId,
      };
      await enqueueCompleteSale(db, clientOperationId, payload);

      if (input.localHeldSaleId) {
        await db.heldSales.delete(input.localHeldSaleId);
      }
    },
  );

  if (!receiptPayload) {
    throw new Error("Sale could not be stored locally");
  }

  return {
    localSaleId,
    clientOperationId,
    invoiceNumber,
    total,
    receiptPayload,
  };
}

/** Restore stock and mark sale failed after server rejection. */
export async function markLocalSaleFailed(localSaleId: string, error: string) {
  const db = await getOfflineDb();
  if (!db) return;

  await db.transaction(
    "rw",
    [db.products, db.branchStock, db.localSales, db.localSaleItems],
    async () => {
      const sale = await db.localSales.get(localSaleId);
      if (!sale || sale.syncStatus === "synced") return;

      if (sale.syncStatus === "pending") {
        const items = await db.localSaleItems.where("localSaleId").equals(localSaleId).toArray();
        for (const item of items) {
          const product = await db.products.get(item.productId);
          if (!product || !sale.branchId) continue;
          await applyLocalBranchStockChange(
            db,
            sale.branchId,
            item.productId,
            item.quantity,
            product,
          );
        }
      }

      await db.localSales.put({
        ...sale,
        syncStatus: "failed",
        lastError: error,
      });
    },
  );
}

export async function markLocalSaleSynced(
  localSaleId: string,
  result: { saleId: string; invoiceNumber: string; receiptPayload: unknown },
) {
  const db = await getOfflineDb();
  if (!db) return;

  await db.transaction("rw", db.localSales, db.localReceipts, async () => {
    const sale = await db.localSales.get(localSaleId);
    if (!sale) return;
    const invoiceNumber = sale.invoiceNumber.toUpperCase().startsWith("INV-")
      ? sale.invoiceNumber
      : result.invoiceNumber;
    await db.localSales.put({
      ...sale,
      syncStatus: "synced",
      serverSaleId: result.saleId,
      invoiceNumber,
      lastError: undefined,
    });
    const receipt = await db.localReceipts.where("localSaleId").equals(localSaleId).first();
    if (receipt) {
      await db.localReceipts.put({
        ...receipt,
        invoiceNumber,
        payloadJson: JSON.stringify(stampPrintedInvoice(result.receiptPayload, invoiceNumber)),
      });
    }
  });
}

export async function discardFailedLocalSale(localSaleId: string) {
  const db = await getOfflineDb();
  if (!db) return;
  await db.transaction(
    "rw",
    db.localSales,
    db.localSaleItems,
    db.localReceipts,
    db.outbox,
    async () => {
      const sale = await db.localSales.get(localSaleId);
      if (!sale || sale.syncStatus !== "failed") return;
      await db.localSaleItems.where("localSaleId").equals(localSaleId).delete();
      await db.localReceipts.where("localSaleId").equals(localSaleId).delete();
      await db.outbox.where("clientOperationId").equals(sale.clientOperationId).delete();
      await db.localSales.delete(localSaleId);
    },
  );
}

export async function holdSaleLocally(input: {
  cashierId: string;
  customerId?: string;
  customerName?: string;
  items: CartLineInput[];
  discount: number;
}): Promise<LocalHeldSale> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local database unavailable");

  let subtotal = 0;
  const items = input.items.map((item) => {
    const gross = roundMoney(item.unitPrice * item.quantity);
    if (!Number.isFinite(item.discount) || item.discount < 0 || item.discount - gross > 0.001) {
      throw new Error(
        item.discount < 0
          ? "Invalid line discount"
          : `Discount exceeds line total for ${item.name}`,
      );
    }
    const lineTotal = roundMoney(gross - item.discount);
    subtotal += lineTotal;
    return {
      productId: item.productId,
      productName: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
    };
  });
  const cartDiscount = roundMoney(input.discount);
  if (!Number.isFinite(cartDiscount) || cartDiscount < 0) {
    throw new Error("Invalid cart discount");
  }
  if (cartDiscount - subtotal > 0.001) {
    throw new Error("Discount cannot exceed the sale subtotal");
  }
  const held: LocalHeldSale = {
    id: newClientId("lhold"),
    cashierId: input.cashierId,
    customerId: input.customerId,
    customerName: input.customerName,
    items,
    subtotal: roundMoney(subtotal),
    discount: cartDiscount,
    total: Math.max(0, roundMoney(subtotal - cartDiscount)),
    heldAt: Date.now(),
  };
  await db.heldSales.put(held);
  return held;
}

export async function listLocalHeldSales(cashierId?: string) {
  const db = await getOfflineDb();
  if (!db) return [];
  let rows = await db.heldSales.toArray();
  if (cashierId) {
    rows = rows.filter((r) => r.cashierId === cashierId);
  }
  return rows.sort((a, b) => b.heldAt - a.heldAt);
}

export async function resumeLocalHeldSale(id: string) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local database unavailable");
  const held = await db.heldSales.get(id);
  if (!held) throw new Error("Held sale not found");
  await db.heldSales.delete(id);
  return held;
}

export async function listFailedLocalSales() {
  const db = await getOfflineDb();
  if (!db) return [];
  return db.localSales.where("syncStatus").equals("failed").toArray();
}

export async function listPendingLocalSales() {
  const db = await getOfflineDb();
  if (!db) return [];
  return db.localSales.where("syncStatus").equals("pending").toArray();
}

/** Write a server-completed sale into Dexie so Orders updates without waiting for a snapshot. */
export async function mirrorCompletedSale(input: {
  saleId: string;
  invoiceNumber: string;
  customerId?: string | null;
  customerName: string;
  cashierId?: string | null;
  cashierName?: string;
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: "cash" | "card" | "mobile_money";
  completedAt: number;
  branchId?: string | null;
  branchName?: string | null;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
  }>;
}): Promise<void> {
  const db = await getOfflineDb();
  if (!db) return;
  const cashierId = input.cashierId ?? (await getMeta(db, META_KEYS.profileUserId)) ?? null;
  const cashierName = input.cashierName ?? (await getMeta(db, META_KEYS.profileName)) ?? "Cashier";
  const branchId = input.branchId ?? (await getMeta(db, META_KEYS.profileBranchId)) ?? null;
  const branchName = input.branchName ?? (await getMeta(db, META_KEYS.profileBranchName)) ?? null;

  const order: MirroredOrder = {
    id: input.saleId,
    invoiceNumber: input.invoiceNumber,
    customerId: input.customerId ?? null,
    customerName: input.customerName,
    cashierId,
    cashierName,
    itemCount: input.itemCount,
    subtotal: input.subtotal,
    discount: input.discount,
    total: input.total,
    paymentMethod: input.paymentMethod,
    status: "completed",
    completedAt: input.completedAt,
    branchId,
    branchName,
    refundedAmount: 0,
  };
  const items: MirroredOrderItem[] = input.items.map((item, index) => ({
    id: `${input.saleId}:${item.productId}:${index}`,
    orderId: input.saleId,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
    lineTotal: item.lineTotal,
    returnedQuantity: 0,
  }));

  await db.transaction("rw", [db.orders, db.orderItems], async () => {
    await db.orders.put(order);
    const existing = await db.orderItems.where("orderId").equals(input.saleId).toArray();
    for (const row of existing) {
      await db.orderItems.delete(row.id);
    }
    if (items.length > 0) {
      await db.orderItems.bulkPut(items);
    }
  });
  notifyReplicaChanged();
}
