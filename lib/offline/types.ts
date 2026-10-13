/** Shared types for the Phase 1 offline mirror + outbox. */

import type { PaymentLine, PaymentMethod } from "@/lib/payments";

export type OutboxStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "failed"
  /** Feature disabled after enqueue — keep the event for review; do not delete. */
  | "blocked_by_entitlement";

export type OutboxOpType =
  | "complete_sale"
  | "process_return"
  | "upsert_supplier"
  | "record_wholesale_purchase"
  | "record_supplier_payment"
  | "wholesale_transfer"
  | "adjust_stock"
  | "update_lot_expiry"
  | "transfer_stock"
  | "upsert_customer"
  | "record_customer_payment"
  | "upsert_customer_group"
  | "upsert_price_rule"
  | "create_expense"
  | "remove_expense"
  | "update_profile"
  | "create_user"
  | "upsert_product"
  | "create_category"
  | "upsert_branch"
  | "upsert_staff_compensation"
  | "pay_salary"
  | "pay_commission"
  | "dining_open_session"
  | "dining_add_session_item"
  | "dining_fire_kitchen_ticket"
  | "dining_pay_session"
  | "hotel_create_reservation"
  | "hotel_check_in"
  | "hotel_add_folio_charge"
  | "hotel_checkout_pay";

export type MirroredDiningTable = {
  id: string;
  branchId: string;
  name: string;
  code?: string | null;
  seats?: number | null;
  status: "active" | "inactive";
  sortOrder?: number | null;
};

export type MirroredDiningSession = {
  id: string;
  branchId: string;
  tableId: string;
  tableName: string;
  status: "open" | "closed";
  openedBy: string;
  openedByName?: string | null;
  openedAt: number;
  guestCount?: number | null;
  note?: string | null;
  syncStatus?: "pending" | "synced" | "conflict";
};

export type MirroredDiningSessionItem = {
  id: string;
  sessionId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  modifiersJson: string;
  kitchenStatus: "pending" | "fired" | "ready" | "done" | "void";
  note?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type MirroredKitchenTicket = {
  id: string;
  branchId: string;
  sessionId: string;
  tableName: string;
  status: "open" | "ready" | "done" | "void";
  firedAt: number;
  updatedAt: number;
  linesJson: string;
};

export type MirroredHotelRoom = {
  id: string;
  branchId: string;
  name: string;
  roomType?: string | null;
  defaultProductId?: string | null;
  status: "available" | "occupied" | "dirty" | "maintenance" | "inactive";
  sortOrder?: number | null;
};

export type MirroredHotelReservation = {
  id: string;
  branchId: string;
  roomId?: string | null;
  roomName?: string | null;
  customerId: string;
  customerName: string;
  arrivalDate: string;
  departureDate: string;
  status: "booked" | "confirmed" | "checked_in" | "cancelled" | "no_show";
  guests?: number | null;
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
  syncStatus?: "pending" | "synced" | "conflict";
};

export type MirroredHotelStay = {
  id: string;
  branchId: string;
  roomId: string;
  roomName: string;
  customerId: string;
  customerName: string;
  reservationId?: string | null;
  status: "open" | "closed";
  checkInAt: number;
  notes?: string | null;
  checkedInBy: string;
  checkedInByName?: string | null;
  syncStatus?: "pending" | "synced" | "conflict";
};

export type MirroredHotelFolioCharge = {
  id: string;
  stayId: string;
  kind: "room" | "product" | "other";
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  status: "open" | "void";
  createdAt: number;
};

export type LocalSaleSyncStatus = "pending" | "synced" | "failed";

export type MirroredProduct = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryId: string;
  categoryName: string;
  sellingPrice: number;
  costPrice: number;
  stockQuantity: number;
  sellableQuantity?: number;
  unit: string;
  sellUnits?: Array<{
    key: string;
    label: string;
    factorToBase: number;
    barcode?: string;
    sellingPrice?: number;
    active: boolean;
  }> | null;
  pricingMode?: "fixed" | "per_weight" | null;
  lowStockThreshold: number;
  status: "active" | "inactive" | "archived";
  description?: string | null;
  imageUrl: string | null;
  tracksExpiry?: boolean;
  /** When false and non_stock_sales is on, sell without stock. Missing = true. */
  tracksInventory?: boolean;
  isVariantParent?: boolean;
  parentProductId?: string | null;
  variantLabel?: string | null;
  variantAttributes?: Array<{ key: string; value: string }> | null;
  tracksSerials?: boolean;
  customValues?: Array<{ key: string; value: string }> | null;
  expiryAlertDays?: number | null;
  nearestExpiry?: string | null;
  expiredQuantity?: number;
  expiringQuantity?: number;
  isExpired?: boolean;
  isExpiring?: boolean;
  updatedAt: number;
};

/** Per-branch sellable stock mirrored for offline POS (admin: all branches). */
export type MirroredBranchStock = {
  id: string;
  branchId: string;
  productId: string;
  quantity: number;
  sellableQuantity: number;
  expiredQuantity?: number;
  expiringQuantity?: number;
  isExpiring?: boolean;
  updatedAt: number;
};

export type MirroredLot = {
  id: string;
  productId: string;
  branchId: string;
  branchName?: string | null;
  quantity: number;
  expiryDate: string;
  lotCode: string;
  receivedAt: number;
};

export type MirroredCategory = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
};

export type MirroredCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes?: string | null;
  status: "active" | "inactive";
  purchaseCount: number;
  lastPurchaseAt: number | null;
  lastPurchaseTotal: number | null;
  lastInvoiceNumber: string | null;
  /** customer_credit: max owed on account. Null/absent = no limit configured. */
  creditLimit?: number | null;
  /** customer_pricing: price-list group. */
  customerGroupId?: string | null;
  /** customer_credit: amount currently owed (positive = customer owes). */
  balance?: number;
  updatedAt: number;
};

/** Receivable ledger row mirrored for managers (offline balances / statements). */
export type MirroredCustomerLedgerEntry = {
  id: string;
  customerId: string;
  type: "sale_charge" | "payment" | "adjustment";
  /** Signed effect on the balance owed. */
  amount: number;
  saleId?: string | null;
  returnId?: string | null;
  method?: PaymentMethod | null;
  note?: string | null;
  occurredAt: number;
  /** Written on this device and not yet confirmed by Convex. */
  syncStatus?: "pending" | "synced";
};

export type MirroredCustomerGroup = {
  id: string;
  name: string;
  status: "active" | "inactive";
};

export type MirroredPriceListRule = {
  id: string;
  productId: string | null;
  categoryId: string | null;
  groupId: string | null;
  minBaseQty: number;
  /** Price per base unit. */
  unitPrice: number;
  priority: number;
  active: boolean;
};

/** Warehouse (wholesale) dated lot for offline FEFO receive / issue. */
export type MirroredWholesaleLot = {
  id: string;
  productId: string;
  quantity: number;
  expiryDate: string;
  receivedAt: number;
  lotCode: string;
};

/** Server sales mirrored for offline Orders / customer stats. */
export type MirroredOrder = {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string;
  cashierId?: string | null;
  cashierName: string;
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
  /** Primary (largest) tender. Split sales carry every line in `payments`. */
  paymentMethod: PaymentMethod;
  payments?: PaymentLine[];
  status: string;
  completedAt: number;
  branchId: string | null;
  branchName: string | null;
  refundedAmount?: number;
};

export type MirroredOrderItem = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  returnedQuantity: number;
};

export type LocalHeldSale = {
  id: string;
  /** Present when this hold also exists on Convex. */
  serverId?: string;
  cashierId: string;
  label?: string;
  customerId?: string;
  customerName?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  heldAt: number;
};

export type LocalSaleItem = {
  id: string;
  localSaleId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discount: number;
  lineTotal: number;
  sellUnitKey?: string;
  sellUnitLabel?: string;
  displayedQuantity?: number;
  factorToBase?: number;
  pricingMode?: "fixed" | "per_weight";
  /** False when the line was sold without stock tracking. */
  trackedInventory?: boolean;
};

export type LocalSale = {
  id: string;
  clientOperationId: string;
  invoiceNumber: string;
  serverSaleId?: string;
  cashierId: string;
  cashierName: string;
  branchId?: string;
  branchName?: string | null;
  customerId?: string;
  customerName: string;
  customerPhone?: string | null;
  subtotal: number;
  discount: number;
  total: number;
  /** Primary (largest) tender. */
  paymentMethod: PaymentMethod;
  /** Normalized tender lines (sum = total). Absent on sales saved before split tenders. */
  payments?: PaymentLine[];
  itemCount: number;
  completedAt: number;
  syncStatus: LocalSaleSyncStatus;
  lastError?: string;
};

export type LocalReceipt = {
  id: string;
  localSaleId: string;
  invoiceNumber: string;
  payloadJson: string;
  createdAt: number;
};

export type CompleteSaleOutboxPayload = {
  localSaleId: string;
  /** Invoice printed on the receipt — Convex must persist this number. */
  invoiceNumber?: string;
  /** Till wall-clock when Pay succeeded — preserved as Convex completedAt. */
  completedAt?: number;
  customerId?: string;
  customerName?: string;
  items: Array<{
    productId: string;
    /** Displayed sell-unit quantity, as entered on the till. */
    quantity: number;
    discount: number;
    sellUnitKey?: string;
    /** Price printed on the receipt. Uploads must not reprice from the live catalog. */
    unitPrice?: number;
    /** Base units already taken off the till. */
    baseQuantity?: number;
    sellUnitLabel?: string;
    factorToBase?: number;
    pricingMode?: "fixed" | "per_weight";
    /** False when this line was sold without stock tracking. */
    trackedInventory?: boolean;
  }>;
  discount: number;
  paymentMethod: PaymentMethod;
  /** Split tenders summing to the sale total. Omitted for single-method sales. */
  payments?: PaymentLine[];
  /** Manager posts the receipt even when the branch no longer has the units. */
  acceptStockShortage?: boolean;
  /** Working branch for this sale (admin may choose; others use assigned). */
  branchId?: string;
  /** Local held sale id if checkout came from a hold. */
  localHeldSaleId?: string;
  serverHeldSaleId?: string;
};

export type ProcessReturnOutboxPayload = {
  localReturnId: string;
  saleId: string;
  /** Return number printed on the receipt — Convex must persist this number. */
  returnNumber?: string;
  reason: string;
  notes?: string;
  /** Branch the return put stock back on. */
  branchId?: string;
  items: Array<{
    saleItemId: string;
    quantity: number;
    /** Kept so a device sale can be matched to server lines after the sale syncs. */
    productId?: string;
    soldQuantity?: number;
  }>;
};

export type LocalReturn = {
  id: string;
  clientOperationId: string;
  saleId: string;
  serverReturnId?: string;
  returnNumber: string;
  reason: string;
  notes?: string;
  refundAmount: number;
  itemCount: number;
  completedAt: number;
  syncStatus: LocalSaleSyncStatus;
  lastError?: string;
  payloadJson: string;
};

export type LocalReturnItem = {
  id: string;
  localReturnId: string;
  saleItemId: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineRefund: number;
};

export type MirroredSupplier = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: "active" | "inactive";
  createdAt: number;
};

export type MirroredWholesaleStock = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  barcode?: string | null;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  tracksExpiry: boolean;
};

export type MirroredWholesalePurchaseItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  unitSellingPrice: number | null;
  lineTotal: number;
};

export type MirroredWholesalePurchase = {
  id: string;
  reference: string;
  invoiceNumber: string | null;
  supplierId: string;
  supplierName: string;
  purchasedAt: number;
  itemCount: number;
  totalCost: number;
  /** Missing on older mirrored rows: those deliveries count as paid. */
  amountPaid?: number | null;
  notes: string | null;
  status: string;
  items?: MirroredWholesalePurchaseItem[];
};

export type MirroredSupplierPayment = {
  id: string;
  supplierId: string;
  purchaseId: string | null;
  amount: number;
  paidAt: number;
  method: "cash" | "card" | "mobile_money";
  note: string | null;
};

export type MirroredWholesaleTransfer = {
  id: string;
  productName: string;
  branchName: string;
  quantity: number;
  note: string | null;
  createdAt: number;
};

export type MirroredBranch = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  status: "active" | "inactive";
};

export type MirroredUser = {
  id: string;
  userId: string;
  name: string;
  role: string;
  branch: string;
  branchId: string | null;
  phone: string | null;
  status: string;
  email: string | null;
  imageUrl: string | null;
  presence?: "online" | "offline";
  lastSeenAt?: number | null;
  lastLoginAt?: number | null;
  lastDevice?: string | null;
  clockedInAt?: number | null;
  clockedInOn?: string | null;
  isOwner?: boolean;
  isSelf?: boolean;
};

export type MirroredExpense = {
  id: string;
  amount: number;
  category: string;
  occurredAt: number;
  description: string | null;
  recordedByName: string;
  recordedByUserId?: string | null;
  branchId: string | null;
  branchName: string | null;
  beneficiaryProfileId?: string | null;
  payPeriodKey?: string | null;
  paymentStatus?: "paid" | "void" | null;
  sourceKind?: "salary" | "commission" | "reimbursement" | null;
};

export type MirroredStaffCompensation = {
  id: string;
  salaryAmount: number | null;
  salaryFrequency: "monthly" | "weekly";
  commissionRate: number | null;
  commissionBasis: "net" | "gross";
  updatedAt: number;
};

export type MirroredReturn = {
  id: string;
  returnNumber: string;
  saleId: string;
  invoiceNumber: string | null;
  refundAmount: number;
  itemCount: number;
  kind: string;
  completedAt: number;
  branchId: string | null;
  branchName: string | null;
  customerName?: string;
  cashierName?: string;
  reason?: string;
  status?: string;
};

export type ProductImageCache = {
  id: string;
  blob: Blob;
  thumbnailBlob?: Blob;
  mimeType: string;
  sourceUrl?: string | null;
  /** Durable Capacitor filesystem URI when the capture was persisted locally */
  localFilePath?: string | null;
  updatedAt: number;
};

export type UpsertSupplierPayload = {
  localId: string;
  serverId?: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  status?: "active" | "inactive";
};

export type RecordWholesalePurchasePayload = {
  localId: string;
  supplierId: string;
  invoiceNumber?: string;
  purchasedAt: number;
  notes?: string;
  /** Omit on older queued purchases. The server records those as paid in full. */
  amountPaid?: number;
  paymentMethod?: "cash" | "card" | "mobile_money";
  clientOperationId?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
    sellingPrice?: number;
    expiryDate?: string;
  }>;
};

export type RecordSupplierPaymentPayload = {
  localId: string;
  supplierId: string;
  purchaseId?: string;
  amount: number;
  paidAt: number;
  method: "cash" | "card" | "mobile_money";
  note?: string;
  clientOperationId?: string;
};

export type WholesaleTransferPayload = {
  localId: string;
  productId: string;
  branchId: string;
  quantity: number;
  clientOperationId?: string;
};

export type AdjustStockPayload = {
  productId: string;
  productName?: string;
  branchId?: string;
  quantityChange: number;
  reason: "receive" | "adjustment" | "damage" | "return";
  note?: string;
  expiryDate?: string;
  clientOperationId?: string;
};

export type UpdateLotExpiryPayload = {
  lotId: string;
  productId: string;
  productName?: string;
  expiryDate: string;
  clientOperationId?: string;
};

export type TransferStockPayload = {
  productId: string;
  productName?: string;
  fromBranchId: string;
  toBranchId: string;
  quantity: number;
  note?: string;
  clientOperationId?: string;
  /** Sellable quantity at the source branch when this transfer was queued. */
  sourceStockSnapshot?: number;
};

export type UpsertCustomerPayload = {
  localId: string;
  serverId?: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  status?: "active" | "inactive";
  /** Manager / admin terms. Null clears; omit to leave unchanged. */
  creditLimit?: number | null;
  customerGroupId?: string | null;
};

export type RecordCustomerPaymentPayload = {
  /** Local ledger row id (`local_…`), replaced by the server row after sync. */
  localId: string;
  customerId: string;
  amount: number;
  method: "cash" | "card" | "mobile_money";
  note?: string;
  paidAt: number;
};

export type UpsertCustomerGroupPayload = {
  localId: string;
  serverId?: string;
  name: string;
  status?: "active" | "inactive";
};

export type UpsertPriceRulePayload = {
  localId: string;
  serverId?: string;
  productId?: string;
  categoryId?: string;
  groupId?: string;
  minBaseQty: number;
  unitPrice: number;
  priority: number;
  active: boolean;
};

export type CreateExpensePayload = {
  localId: string;
  amount: number;
  category: string;
  occurredAt: number;
  description?: string;
  branchId: string;
  clientOperationId?: string;
};

export type RemoveExpensePayload = {
  expenseId: string;
};

export type UpsertStaffCompensationPayload = {
  profileId: string;
  salaryAmount?: number;
  salaryFrequency: "monthly" | "weekly";
  commissionRate?: number;
  commissionBasis: "net" | "gross";
};

export type PaySalaryPayload = {
  profileId: string;
  payPeriodKey: string;
  clientOperationId?: string;
  localExpenseId?: string;
};

export type PayCommissionPayload = {
  profileId: string;
  payPeriodKey: string;
  clientOperationId?: string;
  localExpenseId?: string;
};

export type UpdateProfilePayload = {
  name?: string;
  phone?: string;
};

export type CreateUserPayload = {
  localId: string;
  email: string;
  password: string;
  name: string;
  role: "administrator" | "manager" | "cashier";
  branchId: string;
  phone?: string;
};

export type CreateCategoryPayload = {
  localId: string;
  name: string;
};

export type UpsertBranchPayload = {
  localId: string;
  serverId?: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  status?: "active" | "inactive";
};

export type UpsertProductPayload = {
  localId: string;
  serverId?: string;
  name: string;
  sku: string;
  barcode?: string;
  categoryId: string;
  /** Denormalized label — required when Dexie categories mirror is stale (common on manager devices). */
  categoryName?: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  /** When true on update, apply stockQuantity as an absolute branch set (products.editStock). */
  applyStockQuantity?: boolean;
  unit: string;
  sellUnits?: Array<{
    key: string;
    label: string;
    factorToBase: number;
    barcode?: string;
    sellingPrice?: number;
    active: boolean;
  }>;
  pricingMode?: "fixed" | "per_weight";
  lowStockThreshold: number;
  status: "active" | "inactive";
  description?: string;
  tracksExpiry?: boolean;
  tracksInventory?: boolean;
  isVariantParent?: boolean;
  parentProductId?: string | null;
  variantLabel?: string | null;
  variantAttributes?: Array<{ key: string; value: string }> | null;
  tracksSerials?: boolean;
  customValues?: Array<{ key: string; value: string }> | null;
  expiryAlertDays?: number | null;
  expiryDate?: string;
  imageStorageId?: string;
  hasLocalImage?: boolean;
  /** Clear existing product image on sync (allowed even when uploads are disabled). */
  clearImage?: boolean;
  /** Opening stock branch for new products. Ignored on update. */
  branchId?: string;
};

export type OutboxRow = {
  id: string;
  type: OutboxOpType;
  clientOperationId: string;
  payloadJson: string;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
  /** Current drainer lease owner; cleared when the claim settles. */
  syncOwner?: string;
};

export type OfflineMeta = {
  key: string;
  value: string;
};

export type PrintSnapshot = {
  business: {
    tradeName: string;
    legalName: string;
    branchName?: string;
    address: string;
    phone: string;
    email: string;
    taxId: string;
  };
  template: {
    paperWidthMm: 58 | 80;
    showLogo: boolean;
    headerText: string;
    footerText: string;
    thankYouLine: string;
    showCashier: boolean;
    showCustomer: boolean;
    showPaymentMethod: boolean;
    showSku: boolean;
  };
};

export type OfflineStatus = {
  online: boolean;
  dexieAvailable: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
  syncing: boolean;
};
