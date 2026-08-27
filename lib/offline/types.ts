/** Shared types for the Phase 1 offline mirror + outbox. */

export type OutboxStatus = "pending" | "syncing" | "synced" | "failed";

export type OutboxOpType =
  | "complete_sale"
  | "process_return"
  | "upsert_supplier"
  | "record_wholesale_purchase"
  | "wholesale_transfer"
  | "adjust_stock"
  | "transfer_stock"
  | "upsert_customer"
  | "create_expense"
  | "remove_expense"
  | "update_profile"
  | "create_user"
  | "upsert_product"
  | "create_category"
  | "upsert_branch";

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
  lowStockThreshold: number;
  status: "active" | "inactive" | "archived";
  description?: string | null;
  imageUrl: string | null;
  tracksExpiry?: boolean;
  expiryAlertDays?: number | null;
  nearestExpiry?: string | null;
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
  isExpiring?: boolean;
  updatedAt: number;
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
  updatedAt: number;
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
  paymentMethod: "cash" | "card" | "mobile_money";
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
  paymentMethod: "cash" | "card" | "mobile_money";
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
  customerId?: string;
  customerName?: string;
  items: Array<{
    productId: string;
    quantity: number;
    discount: number;
  }>;
  discount: number;
  paymentMethod: "cash" | "card" | "mobile_money";
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
  items: Array<{
    saleItemId: string;
    quantity: number;
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
  notes: string | null;
  status: string;
  items?: MirroredWholesalePurchaseItem[];
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
  branchId: string | null;
  branchName: string | null;
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
  clientOperationId?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
    sellingPrice?: number;
    expiryDate?: string;
  }>;
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
  branchId?: string;
  quantityChange: number;
  reason: "receive" | "adjustment" | "damage" | "return";
  note?: string;
  expiryDate?: string;
  clientOperationId?: string;
};

export type TransferStockPayload = {
  productId: string;
  fromBranchId: string;
  toBranchId: string;
  quantity: number;
  note?: string;
  clientOperationId?: string;
};

export type UpsertCustomerPayload = {
  localId: string;
  serverId?: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  status?: "active" | "inactive";
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
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  unit: string;
  lowStockThreshold: number;
  status: "active" | "inactive";
  description?: string;
  tracksExpiry?: boolean;
  expiryAlertDays?: number;
  expiryDate?: string;
  imageStorageId?: string;
  hasLocalImage?: boolean;
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
