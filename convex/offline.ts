import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireBranchId } from "./shared/permissions";
import { loadPrintSnapshot } from "./settings";
import { stockMapForBranch } from "./shared/branchStock";
import { deriveExpiryListFields, lotSummaries } from "./shared/lots";
import { canViewCostPrice } from "./shared/permissions";

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
    const { userId, profile, branchId, organizationId } = await requireBranchId(ctx);
    if (
      profile.role !== "administrator" &&
      profile.role !== "manager" &&
      profile.role !== "cashier"
    ) {
      throw new Error("Forbidden");
    }
    const now = Date.now();

    const [
      categories,
      activeProducts,
      activeCustomers,
      stockByProduct,
      summaries,
      branches,
      profiles,
    ] = await Promise.all([
      ctx.db
        .query("categories")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
      ctx.db
        .query("products")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "active"),
        )
        .collect(),
      ctx.db
        .query("customers")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "active"),
        )
        .collect(),
      stockMapForBranch(ctx, branchId),
      lotSummaries(ctx, branchId),
      ctx.db
        .query("branches")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
      ctx.db
        .query("profiles")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
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
      .withIndex("by_organization_completedAt", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(400);

    let orderSales = recentSales.filter((s) => s.status === "completed");
    if (profile.role === "cashier") {
      orderSales = orderSales.filter((s) => s.cashierId === userId);
    } else if (profile.role === "manager") {
      orderSales = orderSales.filter((s) => s.branchId === branchId);
    }
    const saleIds = orderSales.slice(0, 200).map((sale) => sale._id);
    const refundedBySale = new Map<string, number>();
    const returnedByItem = new Map<string, number>();
    if (saleIds.length > 0) {
      const returnRows = await ctx.db
        .query("saleReturns")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
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
      cashierId: sale.cashierId as string,
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

    const print = await loadPrintSnapshot(ctx, profile.organizationId, branchId);
    const { business, template } = print;
    const branch = await ctx.db.get(branchId);
    const canManage = profile.role === "administrator" || profile.role === "manager";

    let suppliers: Array<{
      id: string;
      name: string;
      contactName: string | null;
      phone: string | null;
      email: string | null;
      address: string | null;
      notes: string | null;
      status: "active" | "inactive";
      createdAt: number;
    }> = [];
    let wholesaleStock: Array<{
      id: string;
      productId: string;
      name: string;
      sku: string;
      unit: string;
      costPrice: number;
      quantity: number;
      tracksExpiry: boolean;
    }> = [];
    let wholesalePurchases: Array<{
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
    }> = [];
    let wholesaleTransfers: Array<{
      id: string;
      productName: string;
      branchName: string;
      quantity: number;
      note: string | null;
      createdAt: number;
    }> = [];
    let staff: Array<{
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
      presence: "online" | "offline";
      lastSeenAt: number | null;
      lastLoginAt: number | null;
      lastDevice: string | null;
    }> = [];
    let expenses: Array<{
      id: string;
      amount: number;
      category: string;
      occurredAt: number;
      description: string | null;
      recordedByName: string;
      branchId: string | null;
      branchName: string | null;
    }> = [];

    if (canManage) {
      const [
        supplierRows,
        wholesaleRows,
        purchaseRows,
        transferRows,
        expenseRows,
      ] = await Promise.all([
        ctx.db
          .query("suppliers")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
          .collect(),
        ctx.db
          .query("wholesaleStock")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
          .collect(),
        ctx.db
          .query("supplierPurchases")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
          .collect(),
        ctx.db
          .query("stockTransfers")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
          .collect(),
        ctx.db
          .query("expenses")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
          .collect(),
      ]);

      const productById = new Map(activeProducts.map((p) => [p._id, p]));
      suppliers = supplierRows.map((row) => ({
        id: row._id as string,
        name: row.name,
        contactName: row.contactName ?? null,
        phone: row.phone ?? null,
        email: row.email ?? null,
        address: row.address ?? null,
        notes: row.notes ?? null,
        status: row.status,
        createdAt: row.createdAt,
      }));
      wholesaleStock = wholesaleRows.map((row) => {
        const product = productById.get(row.productId);
        return {
          id: row._id as string,
          productId: row.productId as string,
          name: product?.name ?? "Unknown",
          sku: product?.sku ?? "",
          unit: product?.unit ?? "",
          costPrice: showCost ? (product?.costPrice ?? 0) : 0,
          quantity: row.quantity,
          tracksExpiry: product?.tracksExpiry ?? false,
        };
      });
      const supplierName = new Map(supplierRows.map((s) => [s._id, s.name]));
      wholesalePurchases = purchaseRows
        .sort((a, b) => b.purchasedAt - a.purchasedAt)
        .slice(0, 80)
        .map((row) => ({
          id: row._id as string,
          reference: row.reference,
          invoiceNumber: row.invoiceNumber ?? null,
          supplierId: row.supplierId as string,
          supplierName: supplierName.get(row.supplierId) ?? "Supplier",
          purchasedAt: row.purchasedAt,
          itemCount: row.itemCount,
          totalCost: row.totalCost,
          notes: row.notes ?? null,
          status: row.status,
        }));
      wholesaleTransfers = transferRows
        .filter((row) => (row.kind ?? "branch") === "wholesale")
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 80)
        .map((row) => ({
          id: row._id as string,
          productName: productById.get(row.productId)?.name ?? "Product",
          branchName: branchNameById.get(row.toBranchId) ?? "Branch",
          quantity: row.quantity,
          note: row.note ?? null,
          createdAt: row.createdAt,
        }));
      expenses = expenseRows
        .sort((a, b) => b.occurredAt - a.occurredAt)
        .slice(0, 200)
        .map((row) => ({
          id: row._id as string,
          amount: row.amount,
          category: row.category,
          occurredAt: row.occurredAt,
          description: row.description ?? null,
          recordedByName: nameByUser.get(row.recordedBy) ?? "Unknown",
          branchId: (row.branchId as string | undefined) ?? null,
          branchName: row.branchId ? (branchNameById.get(row.branchId) ?? null) : null,
        }));

      staff = profiles
        .filter((p) =>
          profile.role === "manager"
            ? p.branchId === profile.branchId && (p.role === "cashier" || p._id === profile._id)
            : true,
        )
        .map((p) => ({
          id: p._id as string,
          userId: p.userId as string,
          name: p.name,
          role: p.role,
          branch: p.branchId ? (branchNameById.get(p.branchId) ?? p.branch ?? "") : (p.branch ?? ""),
          branchId: (p.branchId as string | undefined) ?? null,
          phone: p.phone ?? null,
          status: p.status,
          email: null,
          imageUrl: null,
          presence: "offline" as const,
          lastSeenAt: p.lastSeenAt ?? null,
          lastLoginAt: p.lastLoginAt ?? null,
          lastDevice: p.lastDevice ?? null,
        }));
      const authUsers = await Promise.all(
        staff.map((row) => ctx.db.get(row.userId as Id<"users">)),
      );
      const emailById = new Map(
        authUsers.flatMap((u) => (u ? [[String(u._id), u.email ?? null] as const] : [])),
      );
      staff = staff.map((row) => ({
        ...row,
        email: emailById.get(row.userId) ?? null,
      }));
    }

    const returnRows = await ctx.db
      .query("saleReturns")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const invoiceBySale = new Map(orderSales.map((s) => [s._id, s.invoiceNumber]));
    let scopedReturns = returnRows.filter((row) => row.status === "completed");
    if (profile.role === "cashier") {
      scopedReturns = scopedReturns.filter((row) => row.branchId === branchId);
    } else if (profile.role === "manager") {
      scopedReturns = scopedReturns.filter((row) => row.branchId === branchId);
    }
    const returns = scopedReturns
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, 100)
      .map((row) => ({
        id: row._id as string,
        returnNumber: row.returnNumber,
        saleId: row.saleId as string,
        invoiceNumber: invoiceBySale.get(row.saleId) ?? null,
        refundAmount: row.refundAmount,
        itemCount: row.itemCount,
        kind: row.kind ?? "partial",
        completedAt: row.completedAt,
        branchId: row.branchId as string,
        branchName: branchNameById.get(row.branchId) ?? null,
        customerName: row.customerName,
        cashierName: nameByUser.get(row.processedBy) ?? "Cashier",
        reason: row.reason,
        status: row.status,
      }));

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
      suppliers,
      wholesaleStock,
      wholesalePurchases,
      wholesaleTransfers,
      branches: branches
        .filter((b) =>
          profile.role === "administrator" ? true : b._id === branchId,
        )
        .map((b) => ({
          id: b._id as string,
          name: b.name,
          code: b.code,
          address: b.address ?? null,
          phone: b.phone ?? null,
          status: b.status,
        })),
      users: staff,
      expenses,
      returns,
      print: {
        business,
        template,
      },
      profile: {
        userId: userId as string,
        name: profile.name,
        role: profile.role as "administrator" | "manager" | "cashier",
        branchId: branchId as string,
        branchName: branch?.name ?? null,
        organizationId: organizationId as string,
        organizationName: business.tradeName,
      },
    };
  },
});


