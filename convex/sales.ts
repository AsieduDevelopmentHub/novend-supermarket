import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import {
  requireRole,
  requireBranchId,
  resolveBranchFilter,
  isAdmin,
  assertBranchAccess,
  getProfileByUserId,
} from "./shared/permissions";
import { assertPositiveMoney, productMatchesLookup, roundMoney } from "./shared/validation";
import { writeAuditLog } from "./shared/audit";
import { Id } from "./_generated/dataModel";
import { loadPrintSnapshot } from "./settings";
import { applyBranchStockChange, getBranchQuantity, stockMapForBranch } from "./shared/branchStock";
import {
  decreaseLots,
  deriveExpiryListFields,
  getSellableQuantity,
  lotSummaries,
  productTracksExpiry,
} from "./shared/lots";
import { loadReturnableLines } from "./shared/returns";
import { allocateInvoiceNumber, sanitizeInvoiceNumber } from "./shared/documentReferences";

type CartLine = {
  productId: Id<"products">;
  quantity: number;
  discount: number;
};

async function invoiceNumberTaken(
  ctx: MutationCtx,
  organizationId: import("./_generated/dataModel").Id<"organizations">,
  invoiceNumber: string,
) {
  const existing = await ctx.db
    .query("sales")
    .withIndex("by_organization_invoice", (q) =>
      q.eq("organizationId", organizationId).eq("invoiceNumber", invoiceNumber),
    )
    .unique();
  return existing !== null;
}

async function nextInvoiceNumber(
  ctx: MutationCtx,
  organizationId: import("./_generated/dataModel").Id<"organizations">,
  requested?: string,
) {
  if (requested?.trim()) {
    const invoiceNumber = sanitizeInvoiceNumber(requested);
    if (await invoiceNumberTaken(ctx, organizationId, invoiceNumber)) {
      throw new Error("This invoice number is already used");
    }
    return invoiceNumber;
  }
  // Identifiers, not counters. UUID-backed so concurrent checkouts and
  // offline devices never mint the same printed number.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const reference = allocateInvoiceNumber();
    if (!(await invoiceNumberTaken(ctx, organizationId, reference))) return reference;
  }
  throw new Error("Could not allocate a unique invoice reference");
}

export const catalog = query({
  args: {
    search: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { branchId, organizationId } = await requireBranchId(ctx, args.branchId);
    const stockByProduct = await stockMapForBranch(ctx, branchId);
    const summaries = await lotSummaries(ctx, branchId);
    let products = (
      await ctx.db
        .query("products")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "active"),
        )
        .collect()
    ).filter((p) => {
      const onHand = stockByProduct.get(p._id) ?? 0;
      const expiry = deriveExpiryListFields(p, onHand, summaries.get(p._id));
      return expiry.sellableQuantity > 0;
    });
    if (args.search?.trim()) {
      products = products.filter((p) =>
        productMatchesLookup({ name: p.name, sku: p.sku, barcode: p.barcode }, args.search!),
      );
    }
    return await Promise.all(
      products.slice(0, 48).map(async (product) => {
        const onHand = stockByProduct.get(product._id) ?? 0;
        const expiry = deriveExpiryListFields(product, onHand, summaries.get(product._id));
        return {
          id: product._id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          sellingPrice: product.sellingPrice,
          stockQuantity: expiry.sellableQuantity,
          unit: product.unit,
          imageUrl: product.imageStorageId
            ? await ctx.storage.getUrl(product.imageStorageId)
            : null,
          branchId,
          tracksExpiry: expiry.tracksExpiry,
          isExpiring: expiry.isExpiring,
          nearestSellableExpiry: expiry.nearestSellableExpiry,
        };
      }),
    );
  },
});

export const listHeld = query({
  args: {},
  handler: async (ctx) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const all = await ctx.db
      .query("heldSales")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const scoped = isAdmin(profile)
      ? all
      : profile.role === "manager" && profile.branchId
        ? all.filter((row) => row.branchId === profile.branchId)
        : all.filter((row) => row.cashierId === userId);
    return scoped.sort((a, b) => b.heldAt - a.heldAt);
  },
});

export const holdSale = mutation({
  args: {
    label: v.optional(v.string()),
    customerId: v.optional(v.id("customers")),
    customerName: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.id("products"),
        quantity: v.number(),
        discount: v.number(),
      }),
    ),
    discount: v.number(),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { userId, profile, branchId } = await requireBranchId(ctx, args.branchId);
    await requireRole(ctx, ["administrator", "manager", "cashier"]);
    if (!profile.branchId) {
      const branch = await ctx.db.get(branchId);
      await ctx.db.patch(profile._id, {
        branchId,
        branch: branch?.name ?? "Main Branch",
      });
    }
    if (args.items.length === 0) throw new Error("Cart is empty");

    const customerId = args.customerId;
    let customerName = args.customerName?.trim() || "Walk-in Customer";
    if (customerId) {
      const customer = await ctx.db.get(customerId);
      if (
        !customer ||
        customer.organizationId !== profile.organizationId ||
        customer.status !== "active"
      ) {
        throw new Error("Customer not found");
      }
      customerName = customer.name;
    }

    const lines = [];
    let subtotal = 0;
    for (const item of args.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error("Invalid quantity");
      }
      assertPositiveMoney(item.discount, "line discount");
      const product = await ctx.db.get(item.productId);
      if (
        !product ||
        product.status !== "active" ||
        product.organizationId !== profile.organizationId
      ) {
        throw new Error("Product unavailable");
      }
      const gross = roundMoney(product.sellingPrice * item.quantity);
      if (item.discount > gross) {
        throw new Error(`Discount exceeds line total for ${product.name}`);
      }
      const lineSub = roundMoney(gross - item.discount);
      subtotal += lineSub;
      lines.push({
        productId: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.sellingPrice,
        discount: item.discount,
      });
    }

    assertPositiveMoney(args.discount, "cart discount");
    if (roundMoney(args.discount) - roundMoney(subtotal) > 0.001) {
      throw new Error("Discount cannot exceed the sale subtotal");
    }
    const cartDiscount = roundMoney(args.discount);
    const total = Math.max(0, roundMoney(subtotal - cartDiscount));

    return await ctx.db.insert("heldSales", {
      organizationId: profile.organizationId,
      cashierId: userId,
      branchId,
      label: args.label?.trim(),
      customerId,
      customerName,
      items: lines,
      subtotal: roundMoney(subtotal),
      discount: roundMoney(cartDiscount),
      total,
      heldAt: Date.now(),
    });
  },
});

export const resumeHeld = mutation({
  args: { id: v.id("heldSales") },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const held = await ctx.db.get(args.id);
    if (!held || held.organizationId !== organizationId) throw new Error("Held sale not found");
    if (isAdmin(profile)) {
      /* ok */
    } else if (profile.role === "manager") {
      if (held.branchId && held.branchId !== profile.branchId) throw new Error("Forbidden");
    } else if (held.cashierId !== userId) {
      throw new Error("Forbidden");
    }
    await ctx.db.delete(args.id);
    return held;
  },
});

export const getReceipt = query({
  args: { saleId: v.id("sales") },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const sale = await ctx.db.get(args.saleId);
    if (!sale || sale.organizationId !== organizationId) return null;
    if (profile.role === "cashier") {
      if (sale.cashierId !== userId) throw new Error("Forbidden");
    } else if (sale.branchId) {
      assertBranchAccess(profile, sale.branchId);
    }

    const receipt = await ctx.db
      .query("receipts")
      .withIndex("by_sale", (q) => q.eq("saleId", args.saleId))
      .unique();
    if (!receipt) return null;
    try {
      return {
        id: receipt._id,
        saleId: receipt.saleId,
        invoiceNumber: receipt.invoiceNumber,
        createdAt: receipt.createdAt,
        payload: JSON.parse(receipt.payload) as Record<string, unknown>,
      };
    } catch {
      return {
        id: receipt._id,
        saleId: receipt.saleId,
        invoiceNumber: receipt.invoiceNumber,
        createdAt: receipt.createdAt,
        payload: null,
      };
    }
  },
});

export const completeSale = mutation({
  args: {
    customerId: v.optional(v.id("customers")),
    customerName: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.id("products"),
        quantity: v.number(),
        discount: v.number(),
      }),
    ),
    discount: v.number(),
    paymentMethod: v.union(v.literal("cash"), v.literal("card"), v.literal("mobile_money")),
    /** Working branch for this sale (admin may choose; others use assigned). */
    branchId: v.optional(v.id("branches")),
    heldSaleId: v.optional(v.id("heldSales")),
    /** Client-generated idempotency key for offline / retry-safe checkout. */
    clientOperationId: v.optional(v.string()),
    /** Invoice printed at checkout. Convex persists this number; it must not change on sync. */
    invoiceNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, branchId } = await requireBranchId(ctx, args.branchId);
    if (!["administrator", "manager", "cashier"].includes(profile.role)) {
      throw new Error("Forbidden");
    }
    if (!profile.branchId) {
      const branch = await ctx.db.get(branchId);
      await ctx.db.patch(profile._id, {
        branchId,
        branch: branch?.name ?? "Main Branch",
      });
    }

    if (args.clientOperationId?.trim()) {
      const existing = await ctx.db
        .query("saleClientOps")
        .withIndex("by_organization_clientOperationId", (q) =>
          q
            .eq("organizationId", profile.organizationId)
            .eq("clientOperationId", args.clientOperationId!.trim()),
        )
        .unique();
      if (existing) {
        const sale = await ctx.db.get(existing.saleId);
        if (!sale || sale.organizationId !== profile.organizationId) {
          throw new Error("This sale was already submitted and cannot be created again");
        }
        const receipt = await ctx.db
          .query("receipts")
          .withIndex("by_sale", (q) => q.eq("saleId", existing.saleId))
          .unique();
        return {
          saleId: sale._id,
          invoiceNumber: sale.invoiceNumber,
          total: sale.total,
          receiptPayload: receipt
            ? (JSON.parse(receipt.payload) as unknown)
            : { invoiceNumber: sale.invoiceNumber, saleId: sale._id, total: sale.total },
        };
      }
    }

    if (args.items.length === 0) throw new Error("Cart is empty");

    const customerId = args.customerId;
    let customerName = args.customerName?.trim() || "Walk-in Customer";
    let customerPhone: string | null = null;
    if (customerId) {
      const customer = await ctx.db.get(customerId);
      if (
        !customer ||
        customer.organizationId !== profile.organizationId ||
        customer.status !== "active"
      ) {
        throw new Error("Customer not found");
      }
      customerName = customer.name;
      customerPhone = customer.phone ?? null;
    }

    const lines: Array<{
      productId: Id<"products">;
      productName: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      unitCost: number;
      discount: number;
      lineTotal: number;
    }> = [];

    let subtotal = 0;
    let itemCount = 0;

    for (const item of args.items as CartLine[]) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error("Invalid quantity");
      }
      assertPositiveMoney(item.discount, "line discount");
      const product = await ctx.db.get(item.productId);
      if (
        !product ||
        product.status !== "active" ||
        product.organizationId !== profile.organizationId
      ) {
        throw new Error(`Product unavailable`);
      }
      const available = productTracksExpiry(product)
        ? await getSellableQuantity(ctx, branchId, product._id)
        : await getBranchQuantity(ctx, branchId, product._id);
      if (available < item.quantity) {
        throw new Error(`Not enough stock for ${product.name}. Available: ${available}.`);
      }
      const gross = roundMoney(product.sellingPrice * item.quantity);
      if (item.discount > gross) {
        throw new Error(`Discount exceeds line total for ${product.name}`);
      }
      const lineTotal = roundMoney(gross - item.discount);
      if (lineTotal < 0) throw new Error("Invalid line discount");
      subtotal += lineTotal;
      itemCount += item.quantity;
      lines.push({
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitPrice: product.sellingPrice,
        unitCost: product.costPrice,
        discount: item.discount,
        lineTotal,
      });
    }

    assertPositiveMoney(args.discount, "cart discount");
    if (roundMoney(args.discount) - roundMoney(subtotal) > 0.001) {
      throw new Error("Discount cannot exceed the sale subtotal");
    }
    const cartDiscount = roundMoney(args.discount);
    const total = Math.max(0, roundMoney(subtotal - cartDiscount));
    const invoiceNumber = await nextInvoiceNumber(ctx, profile.organizationId, args.invoiceNumber);
    const completedAt = Date.now();
    const snapshot = await loadPrintSnapshot(ctx, profile.organizationId, branchId);

    const saleId = await ctx.db.insert("sales", {
      organizationId: profile.organizationId,
      invoiceNumber,
      cashierId: userId,
      branchId,
      customerId,
      customerName,
      subtotal: roundMoney(subtotal),
      discount: cartDiscount,
      total,
      paymentMethod: args.paymentMethod,
      itemCount,
      status: "completed",
      completedAt,
    });

    for (const line of lines) {
      const { sku: _sku, ...saleItem } = line;
      void _sku;
      const saleItemId = await ctx.db.insert("saleItems", {
        organizationId: profile.organizationId,
        saleId,
        productId: saleItem.productId,
        productName: saleItem.productName,
        quantity: saleItem.quantity,
        unitPrice: saleItem.unitPrice,
        unitCost: saleItem.unitCost,
        discount: saleItem.discount,
        lineTotal: saleItem.lineTotal,
      });
      const product = await ctx.db.get(line.productId);
      if (!product || product.status !== "active") {
        throw new Error("Product unavailable");
      }
      if (productTracksExpiry(product)) {
        const allocations = await decreaseLots(ctx, {
          branchId,
          productId: line.productId,
          quantity: line.quantity,
          reason: "sale",
          sellableOnly: true,
          productName: line.productName,
          performedBy: userId,
          relatedSaleId: saleId,
        });
        for (const allocation of allocations) {
          await ctx.db.insert("saleItemLots", {
            organizationId: profile.organizationId,
            saleItemId,
            lotId: allocation.lotId,
            quantity: allocation.quantity,
            expiryDate: allocation.expiryDate,
          });
        }
      } else {
        await applyBranchStockChange(ctx, {
          branchId,
          productId: line.productId,
          quantityChange: -line.quantity,
          reason: "sale",
          performedBy: userId,
          relatedSaleId: saleId,
        });
      }
    }

    const payload = {
      invoiceNumber,
      saleId,
      branchId,
      subtotal: roundMoney(subtotal),
      discount: cartDiscount,
      total,
      itemCount,
      lines,
      paymentMethod: args.paymentMethod,
      completedAt,
      customerName,
      customerPhone,
      customerId: customerId ?? null,
      cashierName: profile.name,
      cashierId: userId,
      business: snapshot.business,
      template: snapshot.template,
    };

    await ctx.db.insert("receipts", {
      organizationId: profile.organizationId,
      saleId,
      invoiceNumber,
      payload: JSON.stringify(payload),
      createdAt: completedAt,
    });

    if (args.clientOperationId?.trim()) {
      await ctx.db.insert("saleClientOps", {
        organizationId: profile.organizationId,
        clientOperationId: args.clientOperationId.trim(),
        saleId,
        cashierId: userId,
        createdAt: completedAt,
      });
    }

    if (args.heldSaleId) {
      const held = await ctx.db.get(args.heldSaleId);
      if (held && held.organizationId === profile.organizationId) {
        await ctx.db.delete(args.heldSaleId);
      }
    }

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "complete_sale",
      entityType: "sales",
      entityId: saleId,
      metadata: { invoiceNumber, total, branchId },
    });

    return { saleId, invoiceNumber, total, receiptPayload: payload };
  },
});

const paymentMethodValidator = v.union(
  v.literal("cash"),
  v.literal("card"),
  v.literal("mobile_money"),
);

export const listOrders = query({
  args: {
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    branchId: v.optional(v.id("branches")),
    cashierId: v.optional(v.id("users")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    minTotal: v.optional(v.number()),
    maxTotal: v.optional(v.number()),
    paymentMethod: v.optional(paymentMethodValidator),
    returnStatus: v.optional(v.union(v.literal("none"), v.literal("returned"))),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    if (profile.role === "cashier" && args.branchId && args.branchId !== profile.branchId) {
      throw new Error("Forbidden: branch access denied");
    }
    // Cashiers see their own sales even if an older checkout stored the wrong branch.
    const branchFilter =
      profile.role === "cashier" ? null : resolveBranchFilter(profile, args.branchId ?? null);
    const limit = Math.min(args.limit ?? 100, 200);

    if (
      args.startDate !== undefined &&
      args.endDate !== undefined &&
      args.endDate < args.startDate
    ) {
      throw new Error("End date must be on or after the start date");
    }
    if (args.minTotal !== undefined) {
      assertPositiveMoney(args.minTotal, "minimum amount");
    }
    if (args.maxTotal !== undefined) {
      assertPositiveMoney(args.maxTotal, "maximum amount");
    }
    if (
      args.minTotal !== undefined &&
      args.maxTotal !== undefined &&
      args.maxTotal < args.minTotal
    ) {
      throw new Error("Maximum amount must be at least the minimum");
    }

    let cashierFilter: Id<"users"> | undefined =
      profile.role === "cashier" ? userId : args.cashierId;
    if (profile.role !== "cashier" && args.cashierId) {
      const target = await getProfileByUserId(ctx, args.cashierId);
      if (!target || target.organizationId !== organizationId) {
        throw new Error("Cashier not found");
      }
      if (profile.role === "manager" && target.branchId !== profile.branchId) {
        throw new Error("Forbidden");
      }
      cashierFilter = args.cashierId;
    }

    const startDate = args.startDate;
    const endDate = args.endDate;
    const fetchCap = Math.min(Math.max(limit * 8, 400), 2000);
    let sales;
    if (startDate !== undefined && endDate !== undefined) {
      sales = await ctx.db
        .query("sales")
        .withIndex("by_organization_completedAt", (q) =>
          q
            .eq("organizationId", organizationId)
            .gte("completedAt", startDate)
            .lte("completedAt", endDate),
        )
        .order("desc")
        .take(fetchCap);
    } else if (startDate !== undefined) {
      sales = await ctx.db
        .query("sales")
        .withIndex("by_organization_completedAt", (q) =>
          q.eq("organizationId", organizationId).gte("completedAt", startDate),
        )
        .order("desc")
        .take(fetchCap);
    } else if (endDate !== undefined) {
      sales = await ctx.db
        .query("sales")
        .withIndex("by_organization_completedAt", (q) =>
          q.eq("organizationId", organizationId).lte("completedAt", endDate),
        )
        .order("desc")
        .take(fetchCap);
    } else {
      sales = await ctx.db
        .query("sales")
        .withIndex("by_organization_completedAt", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(fetchCap);
    }

    if (branchFilter) {
      sales = sales.filter((s) => s.branchId === branchFilter);
    }
    if (cashierFilter) {
      sales = sales.filter((s) => s.cashierId === cashierFilter);
    }
    if (args.paymentMethod) {
      sales = sales.filter((s) => s.paymentMethod === args.paymentMethod);
    }
    if (args.minTotal !== undefined) {
      sales = sales.filter((s) => s.total >= args.minTotal!);
    }
    if (args.maxTotal !== undefined) {
      sales = sales.filter((s) => s.total <= args.maxTotal!);
    }

    const [profiles, branches, returnRows] = await Promise.all([
      ctx.db
        .query("profiles")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
      ctx.db
        .query("branches")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
      ctx.db
        .query("saleReturns")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
    ]);
    const nameByUser = new Map(profiles.map((p) => [p.userId, p.name]));
    const branchName = new Map(branches.map((b) => [b._id, b.name]));
    const refundedBySale = new Map<Id<"sales">, number>();
    for (const row of returnRows) {
      if (row.status !== "completed") continue;
      refundedBySale.set(row.saleId, (refundedBySale.get(row.saleId) ?? 0) + row.refundAmount);
    }

    if (args.search?.trim()) {
      const q = args.search.trim().toLowerCase();
      sales = sales.filter((s) => {
        const cashierName = nameByUser.get(s.cashierId) ?? "";
        return (
          s.invoiceNumber.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          cashierName.toLowerCase().includes(q)
        );
      });
    }

    if (args.returnStatus === "none") {
      sales = sales.filter((s) => (refundedBySale.get(s._id) ?? 0) === 0);
    } else if (args.returnStatus === "returned") {
      sales = sales.filter((s) => (refundedBySale.get(s._id) ?? 0) > 0);
    }

    return sales
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, limit)
      .map((sale) => ({
        id: sale._id,
        invoiceNumber: sale.invoiceNumber,
        customerId: sale.customerId ?? null,
        customerName: sale.customerName,
        itemCount: sale.itemCount,
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        refundedAmount: roundMoney(refundedBySale.get(sale._id) ?? 0),
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        completedAt: sale.completedAt,
        cashierId: sale.cashierId,
        cashierName: nameByUser.get(sale.cashierId) ?? "Cashier",
        branchId: sale.branchId ?? null,
        branchName: sale.branchId ? (branchName.get(sale.branchId) ?? null) : null,
      }));
  },
});

export const getOrder = query({
  args: { id: v.id("sales") },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const sale = await ctx.db.get(args.id);
    if (!sale || sale.organizationId !== organizationId) return null;
    if (profile.role === "cashier") {
      if (sale.cashierId !== userId) throw new Error("Forbidden");
    } else if (sale.branchId) {
      assertBranchAccess(profile, sale.branchId);
    }

    const items = await ctx.db
      .query("saleItems")
      .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
      .collect();

    const cashierProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", sale.cashierId))
      .unique();

    const receipt = await ctx.db
      .query("receipts")
      .withIndex("by_sale", (q) => q.eq("saleId", sale._id))
      .unique();

    let parsed: Record<string, unknown> | null = null;
    if (receipt) {
      try {
        parsed = JSON.parse(receipt.payload) as Record<string, unknown>;
      } catch {
        parsed = null;
      }
    }

    const returnable = await loadReturnableLines(ctx, sale._id);
    const returnedByItem = new Map(
      returnable.items.map((item) => [item.saleItemId, item] as const),
    );

    const mappedItems = items.map((item) => {
      const returned = returnedByItem.get(item._id);
      return {
        id: item._id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        lineTotal: item.lineTotal,
        returnedQuantity: returned?.returnedQuantity ?? 0,
        remainingQuantity: returned?.remainingQuantity ?? item.quantity,
      };
    });

    const snapshot = await loadPrintSnapshot(ctx, sale.organizationId, sale.branchId);
    const parsedBusiness =
      parsed?.business && typeof parsed.business === "object"
        ? (parsed.business as Record<string, unknown>)
        : null;
    const parsedTemplate =
      parsed?.template && typeof parsed.template === "object"
        ? (parsed.template as Record<string, unknown>)
        : null;

    // Always synthesize a complete printable payload (covers legacy receipts).
    const receiptPayload = {
      ...(parsed ?? {}),
      invoiceNumber: sale.invoiceNumber,
      saleId: sale._id,
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      itemCount: sale.itemCount,
      paymentMethod: sale.paymentMethod,
      completedAt: sale.completedAt,
      customerName: sale.customerName,
      customerId: sale.customerId ?? null,
      cashierName: cashierProfile?.name ?? "Cashier",
      lines:
        Array.isArray(parsed?.lines) && (parsed.lines as unknown[]).length > 0
          ? parsed.lines
          : mappedItems.map((item) => ({
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              lineTotal: item.lineTotal,
            })),
      business: {
        ...(parsedBusiness ?? {}),
        ...snapshot.business,
        // Org title always from settings; branch is a separate line.
        tradeName: snapshot.business.tradeName,
        legalName: snapshot.business.legalName,
        taxId: snapshot.business.taxId,
      },
      template: { ...(parsedTemplate ?? {}), ...snapshot.template },
    };

    return {
      id: sale._id,
      invoiceNumber: sale.invoiceNumber,
      customerId: sale.customerId ?? null,
      customerName: sale.customerName,
      itemCount: sale.itemCount,
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      status: sale.status,
      completedAt: sale.completedAt,
      cashierId: sale.cashierId,
      cashierName: cashierProfile?.name ?? "Cashier",
      refundedAmount: returnable.refundedAmount,
      remainingRefundable: roundMoney(Math.max(0, sale.total - returnable.refundedAmount)),
      canReturn: mappedItems.some((item) => item.remainingQuantity > 0),
      returns: returnable.returns.map((row) => ({
        id: row._id,
        returnNumber: row.returnNumber,
        refundAmount: row.refundAmount,
        reason: row.reason,
        notes: row.notes ?? null,
        itemCount: row.itemCount,
        completedAt: row.completedAt,
        processedBy: row.processedBy,
      })),
      items: mappedItems,
      receiptPayload,
    };
  },
});

export const hold = holdSale;
