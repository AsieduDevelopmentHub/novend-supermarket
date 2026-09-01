import type { Id } from "@/convex/_generated/dataModel";
import { toUserMessage } from "@/lib/errors";
import {
  cleanupStaleOfflineRecords,
  recoverInterruptedSync,
  recordSyncDiagnostics,
} from "./cleanup";
import { getOfflineDb } from "./db";
import {
  claimOutboxRow,
  listPendingOutbox,
  markOutboxFailed,
  markOutboxPending,
  markOutboxSynced,
  parseCompleteSalePayload,
  parseProcessReturnPayload,
  rekeyCategoryReferences,
  replaceIdInPendingOutbox,
} from "./outbox";
import { markLocalSaleFailed, markLocalSaleSynced } from "./sales-repository";
import { markLocalReturnFailed, markLocalReturnSynced } from "./returns-repository";
import { pullOfflineSnapshot, type SnapshotSource } from "./snapshot";
import { isSyncBusinessConflict, isSyncDependencyWait } from "./sync-errors";
import { shouldMarkOutboxFailed } from "./outbox-policy";
import { rekeyProductImage } from "./image-cache";
import type {
  AdjustStockPayload,
  CreateCategoryPayload,
  CreateExpensePayload,
  CreateUserPayload,
  OutboxOpType,
  OutboxRow,
  PayCommissionPayload,
  PaySalaryPayload,
  RecordWholesalePurchasePayload,
  RemoveExpensePayload,
  TransferStockPayload,
  UpdateLotExpiryPayload,
  UpdateProfilePayload,
  UpsertCustomerPayload,
  UpsertProductPayload,
  UpsertStaffCompensationPayload,
  UpsertSupplierPayload,
  UpsertBranchPayload,
  WholesaleTransferPayload,
} from "./types";
import { resolveLocalCategoryToServerId } from "./replica-writes";

function isLocalId(id: string | undefined | null): boolean {
  return !id || id.startsWith("local_");
}

/** Categories (and suppliers) must land on Convex before products that point at them. */
const OUTBOX_DRAIN_PRIORITY: Partial<Record<OutboxOpType, number>> = {
  create_category: 0,
  upsert_supplier: 1,
  upsert_branch: 1,
  create_user: 1,
  upsert_staff_compensation: 1,
  upsert_product: 2,
  pay_salary: 3,
  pay_commission: 3,
};

export function sortOutboxForDrain(rows: OutboxRow[]): OutboxRow[] {
  return [...rows].sort((a, b) => {
    const pa = OUTBOX_DRAIN_PRIORITY[a.type] ?? 5;
    const pb = OUTBOX_DRAIN_PRIORITY[b.type] ?? 5;
    if (pa !== pb) return pa - pb;
    return a.createdAt - b.createdAt;
  });
}

function optionalText(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function hydrateUpsertProductPayload(
  db: NonNullable<Awaited<ReturnType<typeof getOfflineDb>>>,
  payload: UpsertProductPayload,
): Promise<UpsertProductPayload> {
  const local = await db.products.get(payload.localId);
  if (!local) return payload;
  const tracksExpiry = local.tracksExpiry === true;
  return {
    ...payload,
    name: local.name,
    sku: local.sku,
    barcode: local.barcode ?? undefined,
    categoryId: local.categoryId,
    costPrice: local.costPrice,
    sellingPrice: local.sellingPrice,
    unit: local.unit,
    lowStockThreshold: local.lowStockThreshold,
    status: local.status === "archived" ? "inactive" : local.status,
    description: local.description ?? undefined,
    tracksExpiry,
    expiryAlertDays: local.expiryAlertDays ?? undefined,
    expiryDate: tracksExpiry
      ? optionalText(payload.expiryDate) || optionalText(local.nearestExpiry)
      : undefined,
  };
}

export type CompleteSaleMutator = (args: {
  customerId?: Id<"customers">;
  customerName?: string;
  items: Array<{ productId: Id<"products">; quantity: number; discount: number }>;
  discount: number;
  paymentMethod: "cash" | "card" | "mobile_money";
  heldSaleId?: Id<"heldSales">;
  clientOperationId?: string;
  branchId?: Id<"branches">;
  invoiceNumber?: string;
}) => Promise<{
  saleId: Id<"sales">;
  invoiceNumber: string;
  total: number;
  receiptPayload: unknown;
}>;

export type ProcessReturnMutator = (args: {
  saleId: Id<"sales">;
  items: Array<{ saleItemId: Id<"saleItems">; quantity: number }>;
  reason: string;
  notes?: string;
  clientOperationId?: string;
  returnNumber?: string;
}) => Promise<{
  returnId: Id<"saleReturns">;
  returnNumber: string;
  refundAmount: number;
  receiptPayload: unknown;
}>;

let draining = false;
let backoffUntil = 0;
let consecutiveTransientFailures = 0;

const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;
const CLEANUP_EVERY_N_DRAINS = 8;
let drainCycles = 0;

function nextBackoffMs(attempts: number) {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
  const jitter = Math.floor(Math.random() * 400);
  return Math.min(MAX_BACKOFF_MS, exp + jitter);
}

export type QueuedMutators = {
  completeSale: CompleteSaleMutator;
  processReturn: ProcessReturnMutator;
  createSupplier: (args: {
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
  }) => Promise<Id<"suppliers">>;
  updateSupplier: (args: {
    id: Id<"suppliers">;
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    status: "active" | "inactive";
  }) => Promise<Id<"suppliers">>;
  recordPurchase: (
    args: RecordWholesalePurchasePayload & { clientOperationId?: string },
  ) => Promise<unknown>;
  transferToBranch: (args: {
    productId: Id<"products">;
    branchId: Id<"branches">;
    quantity: number;
    clientOperationId?: string;
  }) => Promise<unknown>;
  adjustStock: (args: AdjustStockPayload) => Promise<unknown>;
  updateLotExpiry: (args: UpdateLotExpiryPayload) => Promise<unknown>;
  transferStock: (args: TransferStockPayload) => Promise<unknown>;
  createCustomer: (args: {
    name: string;
    phone?: string;
    email?: string;
    notes?: string;
  }) => Promise<Id<"customers">>;
  updateCustomer: (args: {
    id: Id<"customers">;
    name: string;
    phone?: string;
    email?: string;
    notes?: string;
    status: "active" | "inactive";
  }) => Promise<unknown>;
  createExpense: (args: CreateExpensePayload) => Promise<unknown>;
  removeExpense: (args: { id: Id<"expenses"> }) => Promise<unknown>;
  updateOwnProfile: (args: UpdateProfilePayload & { name: string }) => Promise<unknown>;
  createUserAccount: (args: {
    email: string;
    password: string;
    name: string;
    role: "administrator" | "manager" | "cashier";
    branchId: Id<"branches">;
    phone?: string;
  }) => Promise<unknown>;
  createCategory: (args: { name: string }) => Promise<Id<"categories">>;
  generateUploadUrl: () => Promise<{
    uploadUrl: string;
    sessionId: Id<"storageUploadSessions">;
  }>;
  claimStorageUpload: (args: {
    sessionId: Id<"storageUploadSessions">;
    storageId: Id<"_storage">;
  }) => Promise<unknown>;
  createProduct: (args: {
    name: string;
    sku: string;
    barcode?: string;
    categoryId: Id<"categories">;
    costPrice: number;
    sellingPrice: number;
    stockQuantity: number;
    unit: string;
    lowStockThreshold: number;
    status: "active" | "inactive";
    description?: string;
    imageStorageId?: Id<"_storage">;
    tracksExpiry?: boolean;
    expiryAlertDays?: number;
    expiryDate?: string;
  }) => Promise<string | { toString(): string }>;
  updateProduct: (args: {
    id: Id<"products">;
    name: string;
    sku: string;
    barcode?: string;
    categoryId: Id<"categories">;
    costPrice: number;
    sellingPrice: number;
    unit: string;
    lowStockThreshold: number;
    status: "active" | "inactive";
    description?: string;
    imageStorageId?: Id<"_storage">;
    tracksExpiry?: boolean;
    expiryAlertDays?: number;
    openingExpiryDate?: string;
  }) => Promise<unknown>;
  createBranch: (args: {
    name: string;
    code: string;
    address?: string;
    phone?: string;
  }) => Promise<string | { toString(): string }>;
  updateBranch: (args: {
    id: Id<"branches">;
    name: string;
    code: string;
    address?: string;
    phone?: string;
    status: "active" | "inactive";
  }) => Promise<unknown>;
  upsertStaffCompensation: (args: UpsertStaffCompensationPayload) => Promise<unknown>;
  paySalary: (args: PaySalaryPayload) => Promise<unknown>;
  payCommission: (args: PayCommissionPayload) => Promise<unknown>;
};

/** Drain pending outbox ops to Convex. Safe to call frequently. */
export async function drainOutbox(options: {
  mutators: QueuedMutators;
  convex: SnapshotSource;
  /** Ignore backoff and re-queue failed rows (cashier Sync now / Sync Center). */
  force?: boolean;
  /** Fired only after skip checks fail-open — this is a real drain, not a queue. */
  onStart?: () => void;
}): Promise<{ processed: number; failed: number; skipped: boolean }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { processed: 0, failed: 0, skipped: true };
  }
  if (options.force) {
    backoffUntil = 0;
    consecutiveTransientFailures = 0;
    const started = Date.now();
    while (draining && Date.now() - started < 20_000) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }
  if (draining) return { processed: 0, failed: 0, skipped: true };
  if (!options.force && Date.now() < backoffUntil) {
    return { processed: 0, failed: 0, skipped: true };
  }

  const db = await getOfflineDb();
  if (!db) return { processed: 0, failed: 0, skipped: true };

  draining = true;
  options.onStart?.();
  let processed = 0;
  let failed = 0;
  let lastError: string | null = null;

  try {
    await recoverInterruptedSync(db);

    const stalledWaits = await db.outbox.where("status").equals("failed").toArray();
    for (const row of stalledWaits) {
      if (row.lastError && isSyncDependencyWait(row.lastError)) {
        await markOutboxPending(db, row.id, row.lastError);
      }
    }

    if (options.force) {
      const failedRows = await db.outbox.where("status").equals("failed").toArray();
      for (const row of failedRows) {
        await markOutboxPending(db, row.id);
      }
    }

    drainCycles += 1;
    if (drainCycles % CLEANUP_EVERY_N_DRAINS === 0) {
      try {
        await cleanupStaleOfflineRecords(db);
      } catch {
        /* cleanup best-effort */
      }
    }

    const pending = await listPendingOutbox(db);
    const uploadRows = sortOutboxForDrain(pending);
    for (const row of uploadRows) {
      const claimed = await claimOutboxRow(db, row.id);
      if (!claimed) continue;

      try {
        if (claimed.type === "complete_sale") {
          const payload = parseCompleteSalePayload(claimed);
          const localSale = await db.localSales.get(payload.localSaleId);
          const invoiceNumber = payload.invoiceNumber ?? localSale?.invoiceNumber;
          const result = await options.mutators.completeSale({
            customerId: payload.customerId as Id<"customers"> | undefined,
            customerName: payload.customerName,
            items: payload.items.map((i) => ({
              productId: i.productId as Id<"products">,
              quantity: i.quantity,
              discount: i.discount,
            })),
            discount: payload.discount,
            paymentMethod: payload.paymentMethod,
            heldSaleId: payload.serverHeldSaleId as Id<"heldSales"> | undefined,
            clientOperationId: claimed.clientOperationId,
            branchId: payload.branchId as Id<"branches"> | undefined,
            invoiceNumber,
          });
          await markOutboxSynced(db, claimed.id);
          await markLocalSaleSynced(payload.localSaleId, {
            saleId: result.saleId,
            invoiceNumber: result.invoiceNumber,
            receiptPayload: result.receiptPayload,
          });
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "process_return") {
          const payload = parseProcessReturnPayload(claimed);
          const localReturn = await db.localReturns.get(payload.localReturnId);
          const returnNumber = payload.returnNumber ?? localReturn?.returnNumber;
          const result = await options.mutators.processReturn({
            saleId: payload.saleId as Id<"sales">,
            items: payload.items.map((item) => ({
              saleItemId: item.saleItemId as Id<"saleItems">,
              quantity: item.quantity,
            })),
            reason: payload.reason,
            notes: payload.notes,
            clientOperationId: claimed.clientOperationId,
            returnNumber,
          });
          await markOutboxSynced(db, claimed.id);
          await markLocalReturnSynced(payload.localReturnId, {
            returnId: result.returnId,
            returnNumber: result.returnNumber,
            receiptPayload: result.receiptPayload,
          });
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "upsert_supplier") {
          const payload = JSON.parse(claimed.payloadJson) as UpsertSupplierPayload;
          if (payload.serverId && !payload.serverId.startsWith("local_")) {
            await options.mutators.updateSupplier({
              id: payload.serverId as Id<"suppliers">,
              name: payload.name,
              contactName: payload.contactName,
              phone: payload.phone,
              email: payload.email,
              address: payload.address,
              notes: payload.notes,
              status: payload.status ?? "active",
            });
          } else {
            const id = await options.mutators.createSupplier({
              name: payload.name,
              contactName: payload.contactName,
              phone: payload.phone,
              email: payload.email,
              address: payload.address,
              notes: payload.notes,
            });
            await replaceIdInPendingOutbox(db, payload.localId, id);
            if (payload.localId.startsWith("local_")) {
              await db.suppliers.delete(payload.localId);
            }
          }
          await markOutboxSynced(db, claimed.id);
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "record_wholesale_purchase") {
          const payload = JSON.parse(claimed.payloadJson) as RecordWholesalePurchasePayload;
          if (
            isLocalId(payload.supplierId) ||
            payload.items.some((item) => isLocalId(item.productId))
          ) {
            await markOutboxPending(
              db,
              claimed.id,
              "Waiting for the supplier or product to finish syncing.",
            );
            continue;
          }
          await options.mutators.recordPurchase({
            ...payload,
            supplierId: payload.supplierId,
            clientOperationId: claimed.clientOperationId,
          });
          if (payload.localId.startsWith("local_")) {
            await db.wholesalePurchases.delete(payload.localId);
          }
          await markOutboxSynced(db, claimed.id);
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "wholesale_transfer") {
          const payload = JSON.parse(claimed.payloadJson) as WholesaleTransferPayload;
          await options.mutators.transferToBranch({
            productId: payload.productId as Id<"products">,
            branchId: payload.branchId as Id<"branches">,
            quantity: payload.quantity,
            clientOperationId: claimed.clientOperationId,
          });
          if (payload.localId.startsWith("local_")) {
            await db.wholesaleTransfers.delete(payload.localId);
          }
          await markOutboxSynced(db, claimed.id);
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "adjust_stock") {
          const payload = JSON.parse(claimed.payloadJson) as AdjustStockPayload;
          await options.mutators.adjustStock({
            ...payload,
            clientOperationId: claimed.clientOperationId,
          });
          await markOutboxSynced(db, claimed.id);
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "update_lot_expiry") {
          const payload = JSON.parse(claimed.payloadJson) as UpdateLotExpiryPayload;
          await options.mutators.updateLotExpiry({
            lotId: payload.lotId,
            productId: payload.productId,
            expiryDate: payload.expiryDate,
            clientOperationId: claimed.clientOperationId,
          });
          await markOutboxSynced(db, claimed.id);
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "transfer_stock") {
          const payload = JSON.parse(claimed.payloadJson) as TransferStockPayload;
          await options.mutators.transferStock({
            ...payload,
            clientOperationId: claimed.clientOperationId,
          });
          await markOutboxSynced(db, claimed.id);
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "upsert_customer") {
          const payload = JSON.parse(claimed.payloadJson) as UpsertCustomerPayload;
          if (payload.serverId && !payload.serverId.startsWith("local_")) {
            await options.mutators.updateCustomer({
              id: payload.serverId as Id<"customers">,
              name: payload.name,
              phone: payload.phone,
              email: payload.email,
              notes: payload.notes,
              status: payload.status ?? "active",
            });
          } else {
            const id = await options.mutators.createCustomer({
              name: payload.name,
              phone: payload.phone,
              email: payload.email,
              notes: payload.notes,
            });
            await replaceIdInPendingOutbox(db, payload.localId, id);
            if (payload.localId.startsWith("local_")) {
              await db.customers.delete(payload.localId);
            }
          }
          await markOutboxSynced(db, claimed.id);
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "create_expense") {
          const payload = JSON.parse(claimed.payloadJson) as CreateExpensePayload;
          await options.mutators.createExpense({
            ...payload,
            clientOperationId: claimed.clientOperationId,
          });
          if (payload.localId.startsWith("local_")) {
            await db.expenses.delete(payload.localId);
          }
          await markOutboxSynced(db, claimed.id);
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "remove_expense") {
          const payload = JSON.parse(claimed.payloadJson) as RemoveExpensePayload;
          if (!payload.expenseId.startsWith("local_")) {
            await options.mutators.removeExpense({ id: payload.expenseId as Id<"expenses"> });
          }
          await markOutboxSynced(db, claimed.id);
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "update_profile") {
          const payload = JSON.parse(claimed.payloadJson) as UpdateProfilePayload;
          await options.mutators.updateOwnProfile({
            name: payload.name ?? "User",
            phone: payload.phone,
          });
          await markOutboxSynced(db, claimed.id);
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "create_user") {
          const payload = JSON.parse(claimed.payloadJson) as CreateUserPayload;
          await options.mutators.createUserAccount({
            email: payload.email,
            password: payload.password,
            name: payload.name,
            role: payload.role,
            branchId: payload.branchId as Id<"branches">,
            phone: payload.phone,
          });
          await db.users.delete(payload.localId);
          await markOutboxSynced(db, claimed.id);
          await pullOfflineSnapshot(options.convex, { force: true });
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "create_category") {
          const payload = JSON.parse(claimed.payloadJson) as CreateCategoryPayload;
          const id = await options.mutators.createCategory({ name: payload.name });
          await db.categories.delete(payload.localId);
          await rekeyCategoryReferences(db, payload.localId, String(id));
          await markOutboxSynced(db, claimed.id);
          await pullOfflineSnapshot(options.convex, { force: true });
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "upsert_product") {
          let payload = await hydrateUpsertProductPayload(
            db,
            JSON.parse(claimed.payloadJson) as UpsertProductPayload,
          );
          if (isLocalId(payload.categoryId)) {
            const localProduct = await db.products.get(payload.localId);
            const resolved = resolveLocalCategoryToServerId(
              await db.categories.toArray(),
              payload.categoryId,
              localProduct?.categoryName,
            );
            if (resolved) {
              await rekeyCategoryReferences(db, payload.categoryId, resolved);
              payload = { ...payload, categoryId: resolved };
            }
          }
          if (isLocalId(payload.categoryId)) {
            await markOutboxPending(db, claimed.id, "Waiting for the category to finish syncing.");
            continue;
          }
          let imageStorageId = payload.imageStorageId as Id<"_storage"> | undefined;
          if (imageStorageId && isLocalId(imageStorageId)) {
            imageStorageId = undefined;
          }
          if (payload.hasLocalImage && !imageStorageId) {
            const cached = await db.productImages.get(payload.localId);
            if (cached) {
              const started = await options.mutators.generateUploadUrl();
              const result = await fetch(started.uploadUrl, {
                method: "POST",
                headers: { "Content-Type": cached.mimeType || "image/jpeg" },
                body: cached.blob,
              });
              if (result.ok) {
                const json = (await result.json()) as { storageId: Id<"_storage"> };
                imageStorageId = json.storageId;
                await options.mutators.claimStorageUpload({
                  sessionId: started.sessionId,
                  storageId: json.storageId,
                });
              }
            }
          }
          const categoryId = payload.categoryId as Id<"categories">;
          const barcode = optionalText(payload.barcode);
          const description = optionalText(payload.description);
          if (payload.serverId && !payload.serverId.startsWith("local_")) {
            await options.mutators.updateProduct({
              id: payload.serverId as Id<"products">,
              name: payload.name,
              sku: payload.sku,
              categoryId,
              costPrice: payload.costPrice,
              sellingPrice: payload.sellingPrice,
              unit: payload.unit,
              lowStockThreshold: payload.lowStockThreshold,
              status: payload.status,
              tracksExpiry: payload.tracksExpiry,
              expiryAlertDays: payload.expiryAlertDays,
              openingExpiryDate: optionalText(payload.expiryDate),
              ...(barcode ? { barcode } : {}),
              ...(description ? { description } : {}),
              ...(imageStorageId ? { imageStorageId } : {}),
            });
          } else {
            const createdId = await options.mutators.createProduct({
              name: payload.name,
              sku: payload.sku,
              categoryId,
              costPrice: payload.costPrice,
              sellingPrice: payload.sellingPrice,
              stockQuantity: payload.stockQuantity,
              unit: payload.unit,
              lowStockThreshold: payload.lowStockThreshold,
              status: payload.status,
              tracksExpiry: payload.tracksExpiry,
              expiryAlertDays: payload.expiryAlertDays,
              expiryDate: optionalText(payload.expiryDate),
              ...(barcode ? { barcode } : {}),
              ...(description ? { description } : {}),
              ...(imageStorageId ? { imageStorageId } : {}),
              ...(payload.branchId && !isLocalId(payload.branchId)
                ? { branchId: payload.branchId as Id<"branches"> }
                : {}),
            });
            if (payload.localId.startsWith("local_")) {
              await rekeyProductImage(payload.localId, String(createdId));
              await replaceIdInPendingOutbox(db, payload.localId, String(createdId));
              await db.products.delete(payload.localId);
            }
          }
          await markOutboxSynced(db, claimed.id);
          await pullOfflineSnapshot(options.convex, { force: true });
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "upsert_branch") {
          const payload = JSON.parse(claimed.payloadJson) as UpsertBranchPayload;
          if (payload.serverId && !payload.serverId.startsWith("local_")) {
            await options.mutators.updateBranch({
              id: payload.serverId as Id<"branches">,
              name: payload.name,
              code: payload.code,
              address: payload.address,
              phone: payload.phone,
              status: payload.status ?? "active",
            });
          } else {
            const id = await options.mutators.createBranch({
              name: payload.name,
              code: payload.code,
              address: payload.address,
              phone: payload.phone,
            });
            await replaceIdInPendingOutbox(db, payload.localId, String(id));
            await db.branches.delete(payload.localId);
            await pullOfflineSnapshot(options.convex, { force: true });
          }
          await markOutboxSynced(db, claimed.id);
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "upsert_staff_compensation") {
          const payload = JSON.parse(claimed.payloadJson) as UpsertStaffCompensationPayload;
          await options.mutators.upsertStaffCompensation({
            profileId: payload.profileId as Id<"profiles">,
            salaryAmount: payload.salaryAmount,
            salaryFrequency: payload.salaryFrequency,
            commissionRate: payload.commissionRate,
            commissionBasis: payload.commissionBasis,
          });
          await markOutboxSynced(db, claimed.id);
          await pullOfflineSnapshot(options.convex, { force: true });
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "pay_salary") {
          const payload = JSON.parse(claimed.payloadJson) as PaySalaryPayload;
          await options.mutators.paySalary({
            profileId: payload.profileId as Id<"profiles">,
            payPeriodKey: payload.payPeriodKey,
            clientOperationId: payload.clientOperationId ?? claimed.clientOperationId,
          });
          if (payload.localExpenseId?.startsWith("local_")) {
            await db.expenses.delete(payload.localExpenseId);
          }
          await markOutboxSynced(db, claimed.id);
          await pullOfflineSnapshot(options.convex, { force: true });
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "pay_commission") {
          const payload = JSON.parse(claimed.payloadJson) as PayCommissionPayload;
          await options.mutators.payCommission({
            profileId: payload.profileId as Id<"profiles">,
            payPeriodKey: payload.payPeriodKey,
            clientOperationId: payload.clientOperationId ?? claimed.clientOperationId,
          });
          if (payload.localExpenseId?.startsWith("local_")) {
            await db.expenses.delete(payload.localExpenseId);
          }
          await markOutboxSynced(db, claimed.id);
          await pullOfflineSnapshot(options.convex, { force: true });
          processed += 1;
          consecutiveTransientFailures = 0;
        } else {
          await markOutboxFailed(
            db,
            claimed.id,
            "This event is no longer supported and will not upload.",
          );
          failed += 1;
        }
      } catch (error) {
        const raw = error instanceof Error ? error.message : "Sync failed";
        const message = toUserMessage(error, "Sync failed");
        lastError = message;
        if (isSyncBusinessConflict(raw) && shouldMarkOutboxFailed(claimed.attempts, raw)) {
          if (claimed.type === "process_return") {
            const payload = parseProcessReturnPayload(claimed);
            await markOutboxFailed(db, claimed.id, message);
            await markLocalReturnFailed(payload.localReturnId, message);
          } else if (claimed.type === "complete_sale") {
            const payload = parseCompleteSalePayload(claimed);
            await markOutboxFailed(db, claimed.id, message);
            await markLocalSaleFailed(payload.localSaleId, message);
          } else {
            await markOutboxFailed(db, claimed.id, message);
          }
          failed += 1;
        } else if (isSyncBusinessConflict(raw)) {
          await markOutboxPending(db, claimed.id, message);
          consecutiveTransientFailures += 1;
          backoffUntil =
            Date.now() + nextBackoffMs(Math.max(claimed.attempts, consecutiveTransientFailures));
          break;
        } else {
          // Network / transient — leave pending with exponential backoff
          await markOutboxPending(db, claimed.id, message);
          consecutiveTransientFailures += 1;
          backoffUntil =
            Date.now() + nextBackoffMs(Math.max(claimed.attempts, consecutiveTransientFailures));
          break;
        }
      }
    }

    if (processed > 0) {
      try {
        // Force refresh after successful sync so stock / orders stay accurate.
        await pullOfflineSnapshot(options.convex, { force: true });
      } catch {
        /* snapshot refresh best-effort */
      }
    }

    await recordSyncDiagnostics(db, {
      processed,
      failed,
      error: lastError,
    });
  } finally {
    draining = false;
  }

  return { processed, failed, skipped: false };
}
