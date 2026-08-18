/** Shared types for the Phase 1 offline mirror + outbox. */

export type OutboxStatus = "pending" | "syncing" | "synced" | "failed";

export type OutboxOpType = "complete_sale" | "process_return";

export type LocalSaleSyncStatus = "pending" | "synced" | "failed";

export type MirroredProduct = {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  categoryName: string;
  sellingPrice: number;
  costPrice: number;
  stockQuantity: number;
  sellableQuantity?: number;
  unit: string;
  lowStockThreshold: number;
  status: "active" | "inactive" | "archived";
  imageUrl: string | null;
  tracksExpiry?: boolean;
  expiryAlertDays?: number | null;
  nearestExpiry?: string | null;
  isExpired?: boolean;
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
  customerId?: string;
  customerName?: string;
  items: Array<{
    productId: string;
    quantity: number;
    discount: number;
  }>;
  discount: number;
  paymentMethod: "cash" | "card" | "mobile_money";
  /** Local held sale id if checkout came from a hold. */
  localHeldSaleId?: string;
  serverHeldSaleId?: string;
};

export type ProcessReturnOutboxPayload = {
  localReturnId: string;
  saleId: string;
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
