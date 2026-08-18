import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const roleValidator = v.union(
  v.literal("administrator"),
  v.literal("manager"),
  v.literal("cashier"),
);

export const expenseCategoryValidator = v.union(
  v.literal("salaries"),
  v.literal("transport"),
  v.literal("utilities"),
  v.literal("supplies"),
  v.literal("maintenance"),
  v.literal("misc"),
);

export const inventoryReasonValidator = v.union(
  v.literal("sale"),
  v.literal("receive"),
  v.literal("adjustment"),
  v.literal("damage"),
  v.literal("return"),
  v.literal("expiry"),
  v.literal("seed"),
  v.literal("transfer_out"),
  v.literal("transfer_in"),
  v.literal("wholesale_receive"),
  v.literal("wholesale_issue"),
);

export default defineSchema({
  ...authTables,

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("suspended")),
    ownerUserId: v.id("users"),
    currency: v.string(),
    timezone: v.optional(v.string()),
    taxId: v.optional(v.string()),
    plan: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_ownerUserId", ["ownerUserId"])
    .index("by_status", ["status"]),

  platformAdmins: defineTable({
    userId: v.id("users"),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  branches: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    code: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    receiptShowName: v.optional(v.boolean()),
    receiptShowAddress: v.optional(v.boolean()),
    receiptShowPhone: v.optional(v.boolean()),
    receiptShowEmail: v.optional(v.boolean()),
    receiptPaperWidthMm: v.optional(v.union(v.literal(58), v.literal(80))),
    status: v.union(v.literal("active"), v.literal("inactive")),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_code", ["organizationId", "code"])
    .index("by_code", ["code"])
    .index("by_status", ["status"]),

  profiles: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
    role: roleValidator,
    branch: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
    phone: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    imageStorageId: v.optional(v.id("_storage")),
    lastSeenAt: v.optional(v.number()),
    lastLoginAt: v.optional(v.number()),
    lastDevice: v.optional(v.string()),
    appearanceTheme: v.optional(
      v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
    ),
    appearanceFontSize: v.optional(v.union(v.literal("sm"), v.literal("md"), v.literal("lg"))),
  })
    .index("by_userId", ["userId"])
    .index("by_organization", ["organizationId"])
    .index("by_role", ["role"])
    .index("by_status", ["status"])
    .index("by_branchId", ["branchId"]),

  categories: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    isActive: v.boolean(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_slug", ["organizationId", "slug"])
    .index("by_slug", ["slug"])
    .index("by_active", ["isActive"]),

  products: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    sku: v.string(),
    categoryId: v.id("categories"),
    costPrice: v.number(),
    sellingPrice: v.number(),
    stockQuantity: v.number(),
    unit: v.string(),
    lowStockThreshold: v.number(),
    tracksExpiry: v.optional(v.boolean()),
    expiryAlertDays: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("archived")),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_sku", ["organizationId", "sku"])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_sku", ["sku"])
    .index("by_category", ["categoryId"])
    .index("by_status", ["status"]),

  branchStock: defineTable({
    organizationId: v.id("organizations"),
    branchId: v.id("branches"),
    productId: v.id("products"),
    quantity: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_branch", ["branchId"])
    .index("by_product", ["productId"])
    .index("by_branch_product", ["branchId", "productId"]),

  inventoryHistory: defineTable({
    organizationId: v.id("organizations"),
    productId: v.id("products"),
    branchId: v.optional(v.id("branches")),
    quantityChange: v.number(),
    quantityAfter: v.number(),
    reason: inventoryReasonValidator,
    note: v.optional(v.string()),
    performedBy: v.optional(v.id("users")),
    relatedSaleId: v.optional(v.id("sales")),
    relatedReturnId: v.optional(v.id("saleReturns")),
    relatedTransferId: v.optional(v.id("stockTransfers")),
    relatedLotId: v.optional(v.id("inventoryLots")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_product", ["productId"])
    .index("by_reason", ["reason"])
    .index("by_branch", ["branchId"]),

  inventoryLots: defineTable({
    organizationId: v.id("organizations"),
    branchId: v.id("branches"),
    productId: v.id("products"),
    quantity: v.number(),
    expiryDate: v.string(),
    receivedAt: v.number(),
    lotCode: v.optional(v.string()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_branch", ["branchId"])
    .index("by_product", ["productId"])
    .index("by_branch_product", ["branchId", "productId"])
    .index("by_branch_product_expiry", ["branchId", "productId", "expiryDate"])
    .index("by_expiryDate", ["expiryDate"]),

  stockTransfers: defineTable({
    organizationId: v.id("organizations"),
    kind: v.optional(v.union(v.literal("branch"), v.literal("wholesale"))),
    fromBranchId: v.optional(v.id("branches")),
    toBranchId: v.id("branches"),
    productId: v.id("products"),
    quantity: v.number(),
    note: v.optional(v.string()),
    performedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_fromBranch", ["fromBranchId"])
    .index("by_toBranch", ["toBranchId"])
    .index("by_createdAt", ["createdAt"]),

  suppliers: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_name", ["name"]),

  supplierPurchases: defineTable({
    organizationId: v.id("organizations"),
    supplierId: v.id("suppliers"),
    reference: v.string(),
    invoiceNumber: v.optional(v.string()),
    purchasedAt: v.number(),
    notes: v.optional(v.string()),
    itemCount: v.number(),
    totalCost: v.number(),
    status: v.union(v.literal("completed"), v.literal("void")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_supplier", ["supplierId"])
    .index("by_purchasedAt", ["purchasedAt"])
    .index("by_reference", ["reference"]),

  supplierPurchaseItems: defineTable({
    organizationId: v.id("organizations"),
    purchaseId: v.id("supplierPurchases"),
    productId: v.id("products"),
    productName: v.string(),
    quantity: v.number(),
    unitCost: v.number(),
    lineTotal: v.number(),
    expiryDate: v.optional(v.string()),
  })
    .index("by_purchase", ["purchaseId"])
    .index("by_product", ["productId"]),

  wholesaleStock: defineTable({
    organizationId: v.id("organizations"),
    productId: v.id("products"),
    quantity: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_product", ["productId"])
    .index("by_organization_product", ["organizationId", "productId"]),

  wholesaleLots: defineTable({
    organizationId: v.id("organizations"),
    productId: v.id("products"),
    quantity: v.number(),
    expiryDate: v.string(),
    receivedAt: v.number(),
    lotCode: v.optional(v.string()),
    purchaseId: v.optional(v.id("supplierPurchases")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_product", ["productId"])
    .index("by_organization_product", ["organizationId", "productId"])
    .index("by_expiryDate", ["expiryDate"]),

  sales: defineTable({
    organizationId: v.id("organizations"),
    invoiceNumber: v.string(),
    cashierId: v.id("users"),
    branchId: v.optional(v.id("branches")),
    customerId: v.optional(v.id("customers")),
    customerName: v.string(),
    subtotal: v.number(),
    discount: v.number(),
    total: v.number(),
    paymentMethod: v.union(v.literal("cash"), v.literal("card"), v.literal("mobile_money")),
    itemCount: v.number(),
    status: v.literal("completed"),
    completedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_invoice", ["organizationId", "invoiceNumber"])
    .index("by_organization_completedAt", ["organizationId", "completedAt"])
    .index("by_invoice", ["invoiceNumber"])
    .index("by_cashier", ["cashierId"])
    .index("by_completedAt", ["completedAt"])
    .index("by_customer", ["customerId"])
    .index("by_branch", ["branchId"]),

  saleItems: defineTable({
    organizationId: v.id("organizations"),
    saleId: v.id("sales"),
    productId: v.id("products"),
    productName: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    unitCost: v.optional(v.number()),
    discount: v.number(),
    lineTotal: v.number(),
  })
    .index("by_sale", ["saleId"])
    .index("by_organization", ["organizationId"]),

  saleItemLots: defineTable({
    organizationId: v.id("organizations"),
    saleItemId: v.id("saleItems"),
    lotId: v.id("inventoryLots"),
    quantity: v.number(),
    expiryDate: v.string(),
  })
    .index("by_saleItem", ["saleItemId"])
    .index("by_lot", ["lotId"]),

  saleReturns: defineTable({
    organizationId: v.id("organizations"),
    returnNumber: v.string(),
    saleId: v.id("sales"),
    branchId: v.id("branches"),
    customerId: v.optional(v.id("customers")),
    customerName: v.string(),
    processedBy: v.id("users"),
    reason: v.string(),
    notes: v.optional(v.string()),
    refundAmount: v.number(),
    refundMethod: v.union(v.literal("cash"), v.literal("card"), v.literal("mobile_money")),
    itemCount: v.number(),
    kind: v.optional(v.union(v.literal("full"), v.literal("partial"))),
    status: v.union(v.literal("completed"), v.literal("pending")),
    payload: v.string(),
    completedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_returnNumber", ["returnNumber"])
    .index("by_sale", ["saleId"])
    .index("by_branch", ["branchId"])
    .index("by_completedAt", ["completedAt"])
    .index("by_processedBy", ["processedBy"]),

  saleReturnItems: defineTable({
    organizationId: v.id("organizations"),
    returnId: v.id("saleReturns"),
    saleItemId: v.id("saleItems"),
    productId: v.id("products"),
    productName: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    unitCost: v.optional(v.number()),
    lineRefund: v.number(),
  })
    .index("by_return", ["returnId"])
    .index("by_saleItem", ["saleItemId"]),

  saleReturnItemLots: defineTable({
    organizationId: v.id("organizations"),
    returnItemId: v.id("saleReturnItems"),
    lotId: v.id("inventoryLots"),
    quantity: v.number(),
    expiryDate: v.string(),
  })
    .index("by_returnItem", ["returnItemId"])
    .index("by_lot", ["lotId"]),

  saleReturnClientOps: defineTable({
    organizationId: v.id("organizations"),
    clientOperationId: v.string(),
    returnId: v.id("saleReturns"),
    processedBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_clientOperationId", ["clientOperationId"]),

  expenses: defineTable({
    organizationId: v.id("organizations"),
    amount: v.number(),
    category: expenseCategoryValidator,
    occurredAt: v.number(),
    description: v.optional(v.string()),
    recordedBy: v.id("users"),
    branchId: v.optional(v.id("branches")),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_occurredAt", ["occurredAt"])
    .index("by_category", ["category"])
    .index("by_branch", ["branchId"]),

  heldSales: defineTable({
    organizationId: v.id("organizations"),
    cashierId: v.id("users"),
    branchId: v.optional(v.id("branches")),
    label: v.optional(v.string()),
    customerId: v.optional(v.id("customers")),
    customerName: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.id("products"),
        productName: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        discount: v.number(),
      }),
    ),
    subtotal: v.number(),
    discount: v.number(),
    total: v.number(),
    heldAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_cashier", ["cashierId"])
    .index("by_branch", ["branchId"]),

  customers: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_name", ["name"])
    .index("by_phone", ["phone"])
    .index("by_status", ["status"]),

  receipts: defineTable({
    organizationId: v.id("organizations"),
    saleId: v.id("sales"),
    invoiceNumber: v.string(),
    payload: v.string(),
    createdAt: v.number(),
  })
    .index("by_sale", ["saleId"])
    .index("by_invoice", ["invoiceNumber"]),

  saleClientOps: defineTable({
    organizationId: v.id("organizations"),
    clientOperationId: v.string(),
    saleId: v.id("sales"),
    cashierId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_clientOperationId", ["clientOperationId"])
    .index("by_organization_clientOperationId", ["organizationId", "clientOperationId"]),

  settings: defineTable({
    organizationId: v.id("organizations"),
    key: v.string(),
    value: v.string(),
  })
    .index("by_key", ["key"])
    .index("by_organization_key", ["organizationId", "key"]),

  auditLogs: defineTable({
    organizationId: v.optional(v.id("organizations")),
    actorId: v.optional(v.id("users")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_actor", ["actorId"])
    .index("by_createdAt", ["createdAt"]),

  loginAttempts: defineTable({
    email: v.string(),
    failedCount: v.number(),
    windowStartedAt: v.number(),
    lockedUntil: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),
});


