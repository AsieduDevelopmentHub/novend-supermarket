import { query } from "./_generated/server";
import { requireBranchId } from "./shared/permissions";
import {
  DEFAULT_BUSINESS,
  DEFAULT_RECEIPT_TEMPLATE,
  type BusinessProfile,
  type ReceiptTemplate,
} from "./settings";
import type { QueryCtx } from "./_generated/server";
import { stockMapForBranch } from "./shared/branchStock";
import { deriveExpiryListFields, lotSummaries } from "./shared/lots";
import { canViewCostPrice } from "./shared/permissions";

async function loadSettingJson(ctx: QueryCtx, key: string) {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return row?.value;
}

/**
 * Compact catalog snapshot for Dexie offline mirror.
 * Stock quantities are for the caller's assigned branch.
 * Includes cost prices for local sale line snapshots; cashiers must not display cost in UI.
 *
 * Tuned for bandwidth: indexed status filters, recent orders only (not full sales table).
 */
export const getSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const { userId, profile, branchId } = await requireBranchId(ctx);
    if (
      profile.role !== "administrator" &&
      profile.role !== "manager" &&
      profile.role !== "cashier"
    ) {
      throw new Error("Forbidden");
    }
    const now = Date.now();

    const [categories, activeProducts, activeCustomers, stockByProduct, summaries, branches, profiles] =
      await Promise.all([
        ctx.db.query("categories").collect(),
        ctx.db
          .query("products")
          .withIndex("by_status", (q) => q.eq("status", "active"))
          .collect(),
        ctx.db
          .query("customers")
          .withIndex("by_status", (q) => q.eq("status", "active"))
          .collect(),
        stockMapForBranch(ctx, branchId),
        lotSummaries(ctx, branchId),
        ctx.db.query("branches").collect(),
        ctx.db.query("profiles").collect(),
      ]);

    const categoryMap = new Map(categories.map((c) => [c._id, c.name]));
    const showCost = canViewCostPrice(profile);
    const nameByUser = new Map(profiles.map((p) => [p.userId, p.name]));
    const branchNameById = new Map(branches.map((b) => [b._id, b.name]));

    const mirroredProducts = await Promise.all(
      activeProducts.map(async (product) => {
        const stockQuantity = stockByProduct.get(product._id) ?? 0;
        const expiry = deriveExpiryListFields(product, stockQuantity, summaries.get(product._id));
        return {
          id: product._id as string,
          name: product.name,
          sku: product.sku,
          categoryId: product.categoryId as string,
          categoryName: categoryMap.get(product.categoryId) ?? "Uncategorized",
          sellingPrice: product.sellingPrice,
          // Cashiers must not receive cost prices even in the offline mirror.
          costPrice: showCost ? product.costPrice : 0,
          stockQuantity,
          sellableQuantity: expiry.sellableQuantity,
          unit: product.unit,
          lowStockThreshold: product.lowStockThreshold,
          status: product.status as "active" | "inactive" | "archived",
          imageUrl: product.imageStorageId ? await ctx.storage.getUrl(product.imageStorageId) : null,
          tracksExpiry: expiry.tracksExpiry,
          expiryAlertDays: expiry.expiryAlertDays,
          nearestExpiry: expiry.nearestExpiry,
          isExpired: expiry.isExpired,
          isExpiring: expiry.isExpiring,
          updatedAt: now,
        };
      }),
    );

    // Recent completed sales only — avoid loading the entire sales table into the snapshot.
    const recentSales = await ctx.db
      .query("sales")
      .withIndex("by_completedAt")
      .order("desc")
      .take(400);

    let orderSales = recentSales.filter((s) => s.status === "completed");
    if (profile.role === "cashier") {
      orderSales = orderSales.filter((s) => s.cashierId === userId && s.branchId === branchId);
    } else if (profile.role === "manager") {
      orderSales = orderSales.filter((s) => s.branchId === branchId);
    }
    const saleIds = orderSales.slice(0, 200).map((sale) => sale._id);
    const refundedBySale = new Map<string, number>();
    const returnedByItem = new Map<string, number>();
    if (saleIds.length > 0) {
      const returnRows = await ctx.db.query("saleReturns").collect();
      const relevant = returnRows.filter(
        (row) => row.status === "completed" && saleIds.includes(row.saleId),
      );
      for (const row of relevant) {
        refundedBySale.set(
          row.saleId,
          (refundedBySale.get(row.saleId) ?? 0) + row.refundAmount,
        );
        const returnItems = await ctx.db
          .query("saleReturnItems")
          .withIndex("by_return", (q) => q.eq("returnId", row._id))
          .collect();
        for (const item of returnItems) {
          returnedByItem.set(
            item.saleItemId,
            (returnedByItem.get(item.saleItemId) ?? 0) + item.quantity,
          );
        }
      }
    }

    const mirroredOrders = orderSales.slice(0, 200).map((sale) => ({
      id: sale._id as string,
      invoiceNumber: sale.invoiceNumber,
      customerId: (sale.customerId as string | undefined) ?? null,
      customerName: sale.customerName,
      cashierName: nameByUser.get(sale.cashierId) ?? "Cashier",
      itemCount: sale.itemCount,
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      refundedAmount: refundedBySale.get(sale._id) ?? 0,
      paymentMethod: sale.paymentMethod as "cash" | "card" | "mobile_money",
      status: sale.status,
      completedAt: sale.completedAt,
      branchId: (sale.branchId as string | undefined) ?? null,
      branchName: sale.branchId ? (branchNameById.get(sale.branchId) ?? null) : null,
    }));

    const orderItems = [];
    for (const sale of orderSales.slice(0, 200)) {
      const items = await ctx.db
        .query("saleItems")
        .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
        .collect();
      for (const item of items) {
        orderItems.push({
          id: item._id as string,
          orderId: sale._id as string,
          productId: item.productId as string,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          lineTotal: item.lineTotal,
          returnedQuantity: returnedByItem.get(item._id) ?? 0,
        });
      }
    }

    // Purchase stats from the recent window (same window as mirrored orders).
    const completedInWindow = recentSales.filter((s) => s.status === "completed");
    const customers = activeCustomers.map((c) => {
      const customerSales = completedInWindow
        .filter((s) => s.customerId === c._id)
        .sort((a, b) => b.completedAt - a.completedAt);
      const last = customerSales[0];
      return {
        id: c._id as string,
        name: c.name,
        phone: c.phone ?? null,
        email: c.email ?? null,
        notes: c.notes ?? null,
        status: c.status as "active" | "inactive",
        purchaseCount: customerSales.length,
        lastPurchaseAt: last?.completedAt ?? null,
        lastPurchaseTotal: last?.total ?? null,
        lastInvoiceNumber: last?.invoiceNumber ?? null,
        updatedAt: now,
      };
    });

    let business: BusinessProfile = DEFAULT_BUSINESS;
    let template: ReceiptTemplate = DEFAULT_RECEIPT_TEMPLATE;
    try {
      const raw = await loadSettingJson(ctx, "business.profile");
      if (raw) business = { ...DEFAULT_BUSINESS, ...JSON.parse(raw) };
    } catch {
      /* default */
    }
    try {
      const raw = await loadSettingJson(ctx, "receipt.template");
      if (raw) template = { ...DEFAULT_RECEIPT_TEMPLATE, ...JSON.parse(raw) };
    } catch {
      /* default */
    }

    const branch = await ctx.db.get(branchId);
    const showName = branch ? (branch.receiptShowName ?? true) : false;
    const showAddress = branch ? (branch.receiptShowAddress ?? true) : false;
    const showPhone = branch ? (branch.receiptShowPhone ?? true) : false;
    const showEmail = branch ? (branch.receiptShowEmail ?? true) : false;
    const paperWidthMm =
      branch?.receiptPaperWidthMm === 58 || branch?.receiptPaperWidthMm === 80
        ? branch.receiptPaperWidthMm
        : template.paperWidthMm;

    return {
      products: mirroredProducts,
      categories: categories.map((c) => ({
        id: c._id as string,
        name: c.name,
        slug: c.slug,
        isActive: c.isActive,
      })),
      customers,
      orders: mirroredOrders,
      orderItems,
      print: {
        business: {
          tradeName: business.tradeName,
          legalName: business.legalName,
          branchName: showName && branch ? branch.name : undefined,
          address: showAddress && branch ? (branch.address ?? "") : business.address,
          phone: showPhone && branch ? (branch.phone ?? "") : business.phone,
          email: showEmail && branch ? (branch.email ?? "") : business.email,
          taxId: business.taxId,
        },
        template: {
          paperWidthMm,
          showLogo: template.showLogo,
          headerText: template.headerText,
          footerText: template.footerText,
          thankYouLine: template.thankYouLine,
          showCashier: template.showCashier,
          showCustomer: template.showCustomer,
          showPaymentMethod: template.showPaymentMethod,
          showSku: template.showSku,
        },
      },
      profile: {
        userId: userId as string,
        name: profile.name,
        role: profile.role as "administrator" | "manager" | "cashier",
        branchId: branchId as string,
        branchName: branch?.name ?? null,
        organizationName: business.tradeName,
      },
    };
  },
});


