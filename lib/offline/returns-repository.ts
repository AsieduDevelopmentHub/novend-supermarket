import type { ReceiptPayload } from "@/features/receipts/types";
import { getMeta, getOfflineDb, META_KEYS, newClientId, type NovendOfflineDb } from "./db";
import { allocateReturnNumber } from "@/convex/shared/documentReferences";
import { applyLocalBranchStockChange } from "./branch-stock";
import { enqueueProcessReturn, markOutboxSynced } from "./outbox";
import { assertLocalWriteAllowed } from "./license-guard";
import { notifyReplicaChanged } from "./replica-events";
import { estimateReturnRefund } from "@/lib/sales/returns";
import { roundMoney } from "@/lib/currency";
import type { LocalReturn, LocalReturnItem, PrintSnapshot } from "./types";

export type LocalReturnLineInput = {
  saleItemId: string;
  productId?: string;
  productName: string;
  soldQty: number;
  remainingQty: number;
  lineTotal: number;
  unitPrice: number;
  quantity: number;
};

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

export async function listLocalReturnsForSale(saleId: string): Promise<LocalReturn[]> {
  const db = await getOfflineDb();
  if (!db) return [];
  return db.localReturns.where("saleId").equals(saleId).toArray();
}

export async function listUnsyncedLocalReturns(saleId: string): Promise<LocalReturn[]> {
  const rows = await listLocalReturnsForSale(saleId);
  return rows.filter((row) => row.syncStatus === "pending" || row.syncStatus === "failed");
}

export async function returnedQtyBySaleItem(saleId: string): Promise<Map<string, number>> {
  const db = await getOfflineDb();
  const map = new Map<string, number>();
  if (!db) return map;
  const returns = await listUnsyncedLocalReturns(saleId);
  for (const row of returns) {
    const items = await db.localReturnItems.where("localReturnId").equals(row.id).toArray();
    for (const item of items) {
      map.set(item.saleItemId, (map.get(item.saleItemId) ?? 0) + item.quantity);
    }
  }
  return map;
}

export async function listLocalReturnItems(localReturnId: string): Promise<LocalReturnItem[]> {
  const db = await getOfflineDb();
  if (!db) return [];
  return db.localReturnItems.where("localReturnId").equals(localReturnId).toArray();
}

export async function processReturnLocally(input: {
  saleId: string;
  invoiceNumber: string;
  saleTotal: number;
  saleSubtotal: number;
  saleDiscount: number;
  alreadyRefunded: number;
  remainingQty: number;
  reason: string;
  notes?: string;
  items: LocalReturnLineInput[];
}): Promise<{ returnNumber: string; receiptPayload: ReceiptPayload; clientOperationId: string }> {
  await assertLocalWriteAllowed();
  const db = await getOfflineDb();
  if (!db) throw new Error("Offline storage is unavailable");
  if (input.items.length === 0) throw new Error("Select at least one item to return");

  const refundAmount = estimateReturnRefund({
    saleTotal: input.saleTotal,
    saleSubtotal: input.saleSubtotal,
    saleCartDiscount: input.saleDiscount,
    alreadyRefunded: input.alreadyRefunded,
    remainingQty: input.remainingQty,
    lines: input.items.map((item) => ({
      returningQty: item.quantity,
      soldQty: item.soldQty,
      lineTotal: item.lineTotal,
      remainingQty: item.remainingQty,
    })),
  });

  const now = Date.now();
  const clientOperationId = newClientId("ret");
  const localReturnId = newClientId("lret");
  const returnNumber = allocateReturnNumber();
  const cashierName = (await getMeta(db, META_KEYS.profileName)) ?? "Cashier";
  const snapshot = await loadPrintSnapshot(db);
  const [order, localSale] = await Promise.all([
    db.orders.get(input.saleId),
    input.saleId.startsWith("lsale_")
      ? db.localSales.get(input.saleId)
      : Promise.resolve(undefined),
  ]);
  const branchId =
    order?.branchId ??
    localSale?.branchId ??
    (await getMeta(db, META_KEYS.profileBranchId)) ??
    undefined;

  const receiptPayload: ReceiptPayload = {
    kind: "return",
    invoiceNumber: returnNumber,
    returnNumber,
    originalInvoiceNumber: input.invoiceNumber,
    saleId: input.saleId,
    subtotal: refundAmount,
    discount: 0,
    total: refundAmount,
    itemCount: input.items.reduce((sum, item) => sum + item.quantity, 0),
    lines: input.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: 0,
      lineTotal: roundMoney((item.quantity / item.soldQty) * item.lineTotal),
    })),
    paymentMethod: "cash",
    completedAt: now,
    customerName: "",
    cashierName,
    returnReason: input.reason,
    business: snapshot.business,
    template: snapshot.template,
  };

  const localReturn: LocalReturn = {
    id: localReturnId,
    clientOperationId,
    saleId: input.saleId,
    returnNumber,
    reason: input.reason,
    notes: input.notes,
    refundAmount,
    itemCount: receiptPayload.itemCount,
    completedAt: now,
    syncStatus: "pending",
    payloadJson: JSON.stringify(receiptPayload),
  };

  await db.transaction(
    "rw",
    db.localReturns,
    db.localReturnItems,
    db.products,
    db.branchStock,
    db.outbox,
    async () => {
      await db.localReturns.put(localReturn);
      for (const item of input.items) {
        await db.localReturnItems.put({
          id: newClientId("lreti"),
          localReturnId,
          saleItemId: item.saleItemId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineRefund: roundMoney((item.quantity / item.soldQty) * item.lineTotal),
        });
        if (item.productId && branchId) {
          const product = await db.products.get(item.productId);
          if (product) {
            await applyLocalBranchStockChange(db, branchId, item.productId, item.quantity, product);
          }
        }
      }
      await enqueueProcessReturn(db, clientOperationId, {
        localReturnId,
        saleId: input.saleId,
        returnNumber,
        reason: input.reason,
        notes: input.notes,
        items: input.items.map((item) => ({
          saleItemId: item.saleItemId,
          quantity: item.quantity,
          productId: item.productId,
          soldQuantity: item.soldQty,
        })),
      });
    },
  );

  notifyReplicaChanged({ flush: true });
  return { returnNumber, receiptPayload, clientOperationId };
}

/** Match device sale lines to the server sale after `lsale_` has a `serverSaleId`. */
export function mapReturnLinesToServerSaleItems(
  lines: Array<{
    saleItemId: string;
    quantity: number;
    productId?: string;
    soldQuantity?: number;
  }>,
  localItems: Array<{ id: string; productId: string; quantity: number }>,
  serverItems: Array<{ id: string; productId: string; quantity: number }>,
): Array<{ saleItemId: string; quantity: number }> | null {
  const used = new Set<string>();
  const mapped: Array<{ saleItemId: string; quantity: number }> = [];
  for (const line of lines) {
    const local = localItems.find((item) => item.id === line.saleItemId);
    const productId = line.productId ?? local?.productId;
    const soldQuantity = line.soldQuantity ?? local?.quantity;
    if (!productId) return null;
    const server = serverItems.find(
      (item) =>
        !used.has(item.id) &&
        item.productId === productId &&
        (soldQuantity == null || item.quantity === soldQuantity),
    );
    if (!server) return null;
    used.add(server.id);
    mapped.push({ saleItemId: server.id, quantity: line.quantity });
  }
  return mapped;
}

export async function markLocalReturnSynced(
  localReturnId: string,
  result: { returnId: string; returnNumber: string; receiptPayload: unknown },
  acknowledgement?: { db: NovendOfflineDb; outboxId: string },
) {
  const db = acknowledgement?.db ?? (await getOfflineDb());
  if (!db) return;
  await db.transaction("rw", [db.localReturns, db.outbox], async () => {
    const row = await db.localReturns.get(localReturnId);
    if (!row) {
      if (acknowledgement) {
        throw new Error("Local return missing; upload acknowledgement retained for retry");
      }
      return;
    }
    const returnNumber = row.returnNumber;
    const stamped =
      result.receiptPayload &&
      typeof result.receiptPayload === "object" &&
      !Array.isArray(result.receiptPayload)
        ? { ...result.receiptPayload, returnNumber, invoiceNumber: returnNumber }
        : result.receiptPayload;
    await db.localReturns.put({
      ...row,
      serverReturnId: result.returnId,
      returnNumber,
      syncStatus: "synced",
      payloadJson: JSON.stringify(stamped),
      lastError: undefined,
    });
    if (acknowledgement) await markOutboxSynced(db, acknowledgement.outboxId);
  });
}

export async function markLocalReturnFailed(localReturnId: string, error: string) {
  const db = await getOfflineDb();
  if (!db) return;
  const row = await db.localReturns.get(localReturnId);
  if (!row) return;
  await db.localReturns.put({ ...row, syncStatus: "failed", lastError: error });
}
