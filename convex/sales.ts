import { ConvexError, v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { loadSalePayments } from "./shared/salePaymentLoader";
import {
  requireRole,
  requireBranchId,
  resolveBranchFilter,
  isAdmin,
  assertBranchAccess,
  getProfileByUserId,
} from "./shared/permissions";
import { assertPositiveMoney, productMatchesLookup, roundMoney } from "./shared/validation";
import { catalogSearchRank, salesCatalogResultLimit } from "./shared/salesCatalog";

import { writeAuditLog } from "./shared/audit";
import { Doc, Id } from "./_generated/dataModel";
import { loadPrintSnapshot, loadBusinessConfiguration } from "./settings";
import { applyBranchStockChange, getBranchQuantity, stockMapForBranch } from "./shared/branchStock";
import { paymentMethodValidator } from "./shared/paymentMethod";
import {
  normalizeSalePayments,
  onAccountAmount,
  primarySalePaymentMethod,
  type SalePaymentLine,
} from "./shared/salePayments";
import { assertCreditLimit, customerBalance } from "./shared/customerCredit";
import { resolveUnitPrice } from "./shared/pricing";
import {
  decreaseLots,
  deriveExpiryListFields,
  getSellableQuantity,
  lotSummaries,
  productTracksExpiry,
} from "./shared/lots";
import { loadReturnableLines } from "./shared/returns";
import { allocateInvoiceNumber, sanitizeInvoiceNumber } from "./shared/documentReferences";
import { hasBusinessCapability } from "./shared/businessCapabilities";
import { productTracksInventory } from "./shared/productInventory";
import { assertSellableProduct, catalogDisplayName } from "./shared/productVariants";
import { assertSerialListForQuantity } from "./shared/serialTracking";
import {
  buildSaleLineUnitSnapshot,
  lineGrossForSellUnit,
  resolveSellUnit,
  roundQuantity,
  toBaseQuantity,
} from "./shared/units";
import { bumpOrgSaleStats } from "./shared/organizationStats";
import { resolveSaleCompletedAt } from "./shared/saleTimestamps";

type CartLine = {
  productId: Id<"products">;
  quantity: number;
  discount: number;
  sellUnitKey?: string;
  /** Receipt price. Set when the till already completed the sale. */
  unitPrice?: number;
  /** Base units the till already removed. */
  baseQuantity?: number;
  sellUnitLabel?: string;
  factorToBase?: number;
  pricingMode?: "fixed" | "per_weight";
  trackedInventory?: boolean;
  serialNumbers?: string[];
};

function isSoldSnapshot(item: CartLine) {
  return (
    typeof item.unitPrice === "number" &&
    Number.isFinite(item.unitPrice) &&
    item.unitPrice >= 0 &&
    typeof item.baseQuantity === "number" &&
    Number.isFinite(item.baseQuantity) &&
    item.baseQuantity > 0
  );
}

async function findSaleByInvoice(
  ctx: MutationCtx,
  organizationId: import("./_generated/dataModel").Id<"organizations">,
  invoiceNumber: string,
) {
  return await ctx.db
    .query("sales")
    .withIndex("by_organization_invoice", (q) =>
      q.eq("organizationId", organizationId).eq("invoiceNumber", invoiceNumber),
    )
    .first();
}

async function replayExistingSale(
  ctx: MutationCtx,
  organizationId: import("./_generated/dataModel").Id<"organizations">,
  saleId: import("./_generated/dataModel").Id<"sales">,
) {
  const sale = await ctx.db.get(saleId);
  if (!sale || sale.organizationId !== organizationId) {
    throw new ConvexError("This sale was already submitted and cannot be created again");
  }
  const receipt = await ctx.db
    .query("receipts")
    .withIndex("by_sale", (q) => q.eq("saleId", saleId))
    .unique();
  let receiptPayload: unknown = {
    invoiceNumber: sale.invoiceNumber,
    saleId: sale._id,
    total: sale.total,
  };
  if (receipt) {
    try {
      receiptPayload = JSON.parse(receipt.payload) as unknown;
    } catch {
      receiptPayload = {
        invoiceNumber: sale.invoiceNumber,
        saleId: sale._id,
        total: sale.total,
      };
    }
  }
  return {
    saleId: sale._id,
    invoiceNumber: sale.invoiceNumber,
    total: sale.total,
    receiptPayload,
  };
}

async function nextInvoiceNumber(
  ctx: MutationCtx,
  organizationId: import("./_generated/dataModel").Id<"organizations">,
  requested?: string,
) {
  if (requested?.trim()) {
    const invoiceNumber = sanitizeInvoiceNumber(requested);
    if (await findSaleByInvoice(ctx, organizationId, invoiceNumber)) {
      throw new ConvexError("This invoice number is already used");
    }
    return invoiceNumber;
  }
  // Identifiers, not counters. UUID-backed so concurrent checkouts and
  // offline devices never mint the same printed number.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const reference = allocateInvoiceNumber();
    if (!(await findSaleByInvoice(ctx, organizationId, reference))) return reference;
  }
  throw new ConvexError("Could not allocate a unique invoice reference");
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
    const businessConfig = await loadBusinessConfiguration(ctx, organizationId);
    const query = args.search?.trim() ?? "";
    let products = (
      await ctx.db
        .query("products")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "active"),
        )
        .collect()
    ).filter((p) => {
      if (p.isVariantParent === true) return false;
      if (!productTracksInventory(p, businessConfig)) return true;
      const onHand = stockByProduct.get(p._id) ?? 0;
      const expiry = deriveExpiryListFields(p, onHand, summaries.get(p._id));
      return expiry.sellableQuantity > 0;
    });
    // Filter the full in-stock catalog, then cap — never search only the browse window.
    if (query) {
      products = products.filter((p) =>
        productMatchesLookup(
          {
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            variantLabel: p.variantLabel,
          },
          query,
        ),
      );
      const q = query.toLowerCase();
      products.sort((a, b) => {
        const rankDiff =
          catalogSearchRank(
            { name: a.name, sku: a.sku, barcode: a.barcode, variantLabel: a.variantLabel },
            q,
          ) -
          catalogSearchRank(
            { name: b.name, sku: b.sku, barcode: b.barcode, variantLabel: b.variantLabel },
            q,
          );
        if (rankDiff !== 0) return rankDiff;
        return a.name.localeCompare(b.name);
      });
    } else {
      products.sort((a, b) => a.name.localeCompare(b.name));
    }
    const resultLimit = salesCatalogResultLimit(query);
    const page = products.slice(0, resultLimit);
    return await Promise.all(
      page.map(async (product) => {
        const onHand = stockByProduct.get(product._id) ?? 0;
        const expiry = deriveExpiryListFields(product, onHand, summaries.get(product._id));
        const tracksInventory = productTracksInventory(product, businessConfig);
        return {
          id: product._id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          sellingPrice: product.sellingPrice,
          stockQuantity: tracksInventory ? expiry.sellableQuantity : onHand,
          unit: product.unit,
          sellUnits: product.sellUnits ?? null,
          pricingMode: product.pricingMode ?? null,
          imageUrl: product.imageStorageId
            ? await ctx.storage.getUrl(product.imageStorageId)
            : null,
          branchId,
          tracksExpiry: expiry.tracksExpiry,
          tracksInventory,
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
    let scoped;
    if (isAdmin(profile)) {
      scoped = await ctx.db
        .query("heldSales")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
    } else if (profile.role === "manager" && profile.branchId) {
      scoped = (
        await ctx.db
          .query("heldSales")
          .withIndex("by_branch", (q) => q.eq("branchId", profile.branchId!))
          .collect()
      ).filter((row) => row.organizationId === organizationId);
    } else {
      scoped = (
        await ctx.db
          .query("heldSales")
          .withIndex("by_cashier", (q) => q.eq("cashierId", userId))
          .collect()
      ).filter((row) => row.organizationId === organizationId);
    }
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
    if (args.items.length === 0) throw new ConvexError("Cart is empty");

    const customerId = args.customerId;
    let customerName = args.customerName?.trim() || "Walk-in Customer";
    if (customerId) {
      const customer = await ctx.db.get(customerId);
      if (
        !customer ||
        customer.organizationId !== profile.organizationId ||
        customer.status !== "active"
      ) {
        throw new ConvexError("Customer not found");
      }
      customerName = customer.name;
    }

    const lines = [];
    let subtotal = 0;
    for (const item of args.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new ConvexError("Invalid quantity");
      }
      assertPositiveMoney(item.discount, "line discount");
      const product = await ctx.db.get(item.productId);
      if (
        !product ||
        product.status !== "active" ||
        product.organizationId !== profile.organizationId
      ) {
        throw new ConvexError("Product unavailable");
      }
      const gross = roundMoney(product.sellingPrice * item.quantity);
      if (item.discount > gross) {
        throw new ConvexError(`Discount exceeds line total for ${product.name}`);
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
      throw new ConvexError("Discount cannot exceed the sale subtotal");
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
    if (!held || held.organizationId !== organizationId) throw new ConvexError("Held sale not found");
    if (isAdmin(profile)) {
      /* ok */
    } else if (profile.role === "manager") {
      if (held.branchId && held.branchId !== profile.branchId) throw new ConvexError("Forbidden");
    } else if (held.cashierId !== userId) {
      throw new ConvexError("Forbidden");
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
      if (sale.cashierId !== userId) throw new ConvexError("Forbidden");
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
        /** Displayed sell-unit quantity; converted to base for inventory. */
        quantity: v.number(),
        discount: v.number(),
        sellUnitKey: v.optional(v.string()),
        unitPrice: v.optional(v.number()),
        baseQuantity: v.optional(v.number()),
        sellUnitLabel: v.optional(v.string()),
        factorToBase: v.optional(v.number()),
        pricingMode: v.optional(v.union(v.literal("fixed"), v.literal("per_weight"))),
        /** False when the till sold this line without stock tracking. */
        trackedInventory: v.optional(v.boolean()),
        serialNumbers: v.optional(v.array(v.string())),
      }),
    ),
    discount: v.number(),
    paymentMethod: paymentMethodValidator,
    /**
     * Split tenders. Must sum to the sale total. Omit for a single-method sale
     * (`paymentMethod` covers the whole total).
     */
    payments: v.optional(
      v.array(
        v.object({
          method: paymentMethodValidator,
          amount: v.number(),
        }),
      ),
    ),
    /** Working branch for this sale (admin may choose; others use assigned). */
    branchId: v.optional(v.id("branches")),
    heldSaleId: v.optional(v.id("heldSales")),
    /** Client-generated idempotency key for offline / retry-safe checkout. */
    clientOperationId: v.optional(v.string()),
    /** Invoice printed at checkout. Convex persists this number; it must not change on sync. */
    invoiceNumber: v.optional(v.string()),
    /** Till wall-clock when Pay succeeded (Dexie-first / offline outbox). */
    clientCompletedAt: v.optional(v.number()),
    /**
     * Manager posts a receipt that already left the till. Stock is reduced only
     * by what this branch still has, and never below zero.
     */
    acceptStockShortage: v.optional(v.boolean()),
    /** Cash received at the till — printed as Paid / Change on the receipt. */
    amountPaid: v.optional(v.number()),
    changeGiven: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, branchId } = await requireBranchId(ctx, args.branchId);
    if (!["administrator", "manager", "cashier"].includes(profile.role)) {
      throw new ConvexError("Forbidden");
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
        return await replayExistingSale(ctx, profile.organizationId, existing.saleId);
      }
    }

    // The till already printed this invoice. A lost response must not create a
    // second sale or leave the outbox failing forever.
    if (args.invoiceNumber?.trim()) {
      const printed = sanitizeInvoiceNumber(args.invoiceNumber);
      const already = await findSaleByInvoice(ctx, profile.organizationId, printed);
      if (already) {
        if (already.cashierId !== userId) {
          throw new ConvexError("This invoice number is already used");
        }
        return await replayExistingSale(ctx, profile.organizationId, already._id);
      }
    }

    if (args.items.length === 0) throw new ConvexError("Cart is empty");

    const customerId = args.customerId;
    let customerName = args.customerName?.trim() || "Walk-in Customer";
    let customerPhone: string | null = null;
    let customerDoc: Doc<"customers"> | null = null;
    if (customerId) {
      const customer = await ctx.db.get(customerId);
      if (
        !customer ||
        customer.organizationId !== profile.organizationId ||
        customer.status !== "active"
      ) {
        throw new ConvexError("Customer not found");
      }
      customerDoc = customer;
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
      sellUnitKey: string;
      sellUnitLabel: string;
      displayedQuantity: number;
      factorToBase: number;
      pricingMode: "fixed" | "per_weight";
      /** Units this upload may remove. Less than quantity when a manager posts a shortage. */
      stockQuantity: number;
      serialNumbers?: string[];
    }> = [];

    let subtotal = 0;
    let itemCount = 0;
    const stockShortages: Array<{ productName: string; requested: number; removed: number }> = [];
    const canPostShortage =
      args.acceptStockShortage === true &&
      (profile.role === "administrator" || profile.role === "manager");
    if (args.acceptStockShortage === true && !canPostShortage) {
      throw new ConvexError("A manager has to post this receipt.");
    }

    const businessConfig = await loadBusinessConfiguration(ctx, profile.organizationId);
    const multiUnitOn = hasBusinessCapability(businessConfig, "multi_unit_pricing");
    const weightOn = hasBusinessCapability(businessConfig, "sell_by_weight");
    const pricingOn = hasBusinessCapability(businessConfig, "customer_pricing");
    const creditOn = hasBusinessCapability(businessConfig, "customer_credit");
    const serialsOn = hasBusinessCapability(businessConfig, "serial_tracking");
    const priceRules = pricingOn
      ? (
          await ctx.db
            .query("priceListRules")
            .withIndex("by_organization", (q) => q.eq("organizationId", profile.organizationId))
            .collect()
        ).filter((rule) => rule.active)
      : [];
    const customerGroupId = customerDoc?.customerGroupId ?? null;

    for (const item of args.items as CartLine[]) {
      assertPositiveMoney(item.discount, "line discount");
      const replay = isSoldSnapshot(item);
      const product = await ctx.db.get(item.productId);
      if (!product || product.organizationId !== profile.organizationId) {
        throw new ConvexError(`Product unavailable`);
      }
      if (!replay && product.status !== "active") {
        throw new ConvexError(`Product unavailable`);
      }
      try {
        assertSellableProduct(product);
      } catch (error) {
        throw new ConvexError(error instanceof Error ? error.message : "Product unavailable");
      }

      const allowFractional =
        (weightOn && product.pricingMode === "per_weight") ||
        (replay && item.pricingMode === "per_weight");
      const displayedQuantity = roundQuantity(item.quantity);
      if (!Number.isFinite(displayedQuantity) || displayedQuantity <= 0) {
        throw new ConvexError("Invalid quantity");
      }
      if (!allowFractional && !Number.isInteger(displayedQuantity)) {
        throw new ConvexError("Invalid quantity");
      }

      let unit;
      try {
        unit = resolveSellUnit(
          product,
          multiUnitOn || weightOn || replay ? item.sellUnitKey : undefined,
        );
      } catch (error) {
        if (!replay) throw error;
        unit = {
          key: item.sellUnitKey || "default",
          label: item.sellUnitLabel || product.unit || "unit",
          factorToBase:
            typeof item.factorToBase === "number" && item.factorToBase > 0 ? item.factorToBase : 1,
          unitPrice: item.unitPrice!,
          costPerBase: product.costPrice,
          pricingMode: item.pricingMode === "per_weight" ? "per_weight" : "fixed",
          synthesized: true,
        } as const;
      }
      if (
        !replay &&
        !multiUnitOn &&
        !weightOn &&
        item.sellUnitKey &&
        item.sellUnitKey !== "default"
      ) {
        throw new ConvexError("Multi-unit pricing is not enabled for this organization");
      }
      if (!replay && unit.pricingMode === "per_weight" && !weightOn) {
        throw new ConvexError("Sell by weight is not enabled for this organization");
      }
      if (!replay && pricingOn && priceRules.length > 0) {
        const resolved = resolveUnitPrice(
          priceRules.map((rule) => ({
            id: rule._id,
            productId: rule.productId ?? null,
            categoryId: rule.categoryId ?? null,
            groupId: rule.groupId ?? null,
            minBaseQty: rule.minBaseQty,
            unitPrice: rule.unitPrice,
            priority: rule.priority,
            active: rule.active,
          })),
          {
            productId: product._id,
            categoryId: product.categoryId,
            customerGroupId,
            baseQuantity: toBaseQuantity(displayedQuantity, unit.factorToBase),
            factorToBase: unit.factorToBase,
            pricingMode: unit.pricingMode,
            sellUnitPrice: unit.unitPrice,
            productSellingPrice: product.sellingPrice,
          },
        );
        unit = { ...unit, unitPrice: resolved.unitPrice };
      }
      if (replay) {
        const factor =
          typeof item.factorToBase === "number" && item.factorToBase > 0
            ? item.factorToBase
            : unit.factorToBase;
        unit = {
          ...unit,
          key: item.sellUnitKey || unit.key,
          label: item.sellUnitLabel || unit.label,
          factorToBase: factor,
          unitPrice: item.unitPrice!,
          pricingMode: item.pricingMode ?? unit.pricingMode,
        };
      }

      const snapshot = replay
        ? {
            sellUnitKey: unit.key,
            sellUnitLabel: unit.label,
            displayedQuantity,
            baseQuantity: item.baseQuantity!,
            factorToBase: unit.factorToBase,
            pricingMode: unit.pricingMode,
          }
        : buildSaleLineUnitSnapshot(unit, displayedQuantity);
      let stockQuantity = 0;
      const soldWithoutStock = item.trackedInventory === false;
      if (!soldWithoutStock && productTracksInventory(product, businessConfig)) {
        // The receipt already printed. A lot that expires before upload must not
        // reject it. Physical stock at this branch still cannot go negative.
        const available =
          replay || !productTracksExpiry(product)
            ? await getBranchQuantity(ctx, branchId, product._id)
            : await getSellableQuantity(ctx, branchId, product._id);
        if (available < snapshot.baseQuantity) {
          // The receipt is already in the customer's hand. Save the sale and
          // remove only the units still on the branch. A rejected upload used
          // to leave that sale on the till, so Orders and Reports diverged.
          if (replay) {
            stockQuantity = Math.max(0, available);
            stockShortages.push({
              productName: product.name,
              requested: snapshot.baseQuantity,
              removed: stockQuantity,
            });
          } else {
            throw new ConvexError(
              `Not enough stock for ${product.name}. Available: ${available}.`,
            );
          }
        } else {
          stockQuantity = snapshot.baseQuantity;
        }
      }
      const gross = lineGrossForSellUnit(unit, snapshot.displayedQuantity);
      if (item.discount > gross) {
        throw new ConvexError(`Discount exceeds line total for ${product.name}`);
      }
      const lineTotal = roundMoney(gross - item.discount);
      if (lineTotal < 0) throw new ConvexError("Invalid line discount");
      let serialNumbers: string[] | undefined;
      if (serialsOn && product.tracksSerials === true) {
        try {
          serialNumbers = assertSerialListForQuantity(
            item.serialNumbers,
            snapshot.baseQuantity,
            catalogDisplayName(product),
          );
        } catch (error) {
          throw new ConvexError(error instanceof Error ? error.message : "Invalid serial numbers");
        }
        for (const serial of serialNumbers) {
          const existing = await ctx.db
            .query("productSerials")
            .withIndex("by_organization_serial", (q) =>
              q.eq("organizationId", profile.organizationId).eq("serial", serial),
            )
            .unique();
          if (existing && existing.status === "sold" && !replay) {
            throw new ConvexError(`Serial ${serial} was already sold`);
          }
          if (existing && existing.productId !== product._id) {
            throw new ConvexError(`Serial ${serial} belongs to another product`);
          }
        }
      }

      subtotal += lineTotal;
      itemCount += snapshot.baseQuantity;
      lines.push({
        productId: product._id,
        productName: catalogDisplayName(product),
        sku: product.sku,
        quantity: snapshot.baseQuantity,
        unitPrice: unit.unitPrice,
        unitCost: product.costPrice,
        discount: item.discount,
        lineTotal,
        sellUnitKey: snapshot.sellUnitKey,
        sellUnitLabel: snapshot.sellUnitLabel,
        displayedQuantity: snapshot.displayedQuantity,
        factorToBase: snapshot.factorToBase,
        pricingMode: snapshot.pricingMode,
        stockQuantity,
        serialNumbers,
      });
    }

    assertPositiveMoney(args.discount, "cart discount");
    if (roundMoney(args.discount) - roundMoney(subtotal) > 0.001) {
      throw new ConvexError("Discount cannot exceed the sale subtotal");
    }
    const cartDiscount = roundMoney(args.discount);
    const total = Math.max(0, roundMoney(subtotal - cartDiscount));

    let payments: SalePaymentLine[];
    try {
      payments = normalizeSalePayments(args.payments, args.paymentMethod, total);
    } catch (error) {
      throw new ConvexError(error instanceof Error ? error.message : "Invalid payments");
    }
    const primaryTender = payments.length > 0 ? primarySalePaymentMethod(payments) : args.paymentMethod;
    const chargeOnAccount = onAccountAmount(payments);
    if (chargeOnAccount > 0) {
      if (!creditOn) {
        throw new ConvexError("Customer credit is not enabled for this organization");
      }
      if (!customerDoc || !customerId) {
        throw new ConvexError("Choose a customer to sell on account");
      }
      const ledger = await ctx.db
        .query("customerLedgerEntries")
        .withIndex("by_organization_customer_occurredAt", (q) =>
          q.eq("organizationId", profile.organizationId).eq("customerId", customerId),
        )
        .collect();
      try {
        assertCreditLimit({
          currentBalance: customerBalance(ledger),
          charge: chargeOnAccount,
          limit: customerDoc.creditLimit,
        });
      } catch (error) {
        throw new ConvexError(error instanceof Error ? error.message : "Credit limit exceeded");
      }
    }

    const invoiceNumber = await nextInvoiceNumber(ctx, profile.organizationId, args.invoiceNumber);
    const syncedAt = Date.now();
    const { completedAt } = resolveSaleCompletedAt(args.clientCompletedAt, syncedAt);
    const snapshot = await loadPrintSnapshot(ctx, profile.organizationId, branchId);

    const tenderPaid =
      typeof args.amountPaid === "number"
        ? {
            amountPaid: roundMoney(args.amountPaid),
            changeGiven: roundMoney(
              typeof args.changeGiven === "number"
                ? Math.max(0, args.changeGiven)
                : Math.max(0, args.amountPaid - total),
            ),
          }
        : {};

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
      paymentMethod: primaryTender,
      ...tenderPaid,
      itemCount,
      status: "completed",
      completedAt,
      syncedAt,
    });

    for (const line of payments) {
      await ctx.db.insert("salePayments", {
        organizationId: profile.organizationId,
        saleId,
        method: line.method,
        amount: line.amount,
      });
    }
    if (chargeOnAccount > 0 && customerId) {
      await ctx.db.insert("customerLedgerEntries", {
        organizationId: profile.organizationId,
        customerId,
        type: "sale_charge",
        amount: chargeOnAccount,
        saleId,
        method: "on_account",
        note: `Sale ${invoiceNumber}`,
        occurredAt: completedAt,
        performedBy: userId,
      });
    }

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
        sellUnitKey: saleItem.sellUnitKey,
        sellUnitLabel: saleItem.sellUnitLabel,
        displayedQuantity: saleItem.displayedQuantity,
        factorToBase: saleItem.factorToBase,
        pricingMode: saleItem.pricingMode,
        serialNumbers: saleItem.serialNumbers,
      });
      if (saleItem.serialNumbers?.length) {
        for (const serial of saleItem.serialNumbers) {
          const existing = await ctx.db
            .query("productSerials")
            .withIndex("by_organization_serial", (q) =>
              q.eq("organizationId", profile.organizationId).eq("serial", serial),
            )
            .unique();
          if (existing) {
            await ctx.db.patch(existing._id, {
              status: "sold",
              saleId,
              saleItemId,
              soldAt: completedAt,
            });
          } else {
            await ctx.db.insert("productSerials", {
              organizationId: profile.organizationId,
              productId: saleItem.productId,
              serial,
              status: "sold",
              saleId,
              saleItemId,
              createdAt: completedAt,
              soldAt: completedAt,
            });
          }
        }
      }
      const product = await ctx.db.get(line.productId);
      if (!product || product.status !== "active") {
        throw new ConvexError("Product unavailable");
      }
      if (!productTracksInventory(product, businessConfig) || line.stockQuantity <= 0) {
        continue;
      }
      if (productTracksExpiry(product)) {
        const allocations = await decreaseLots(ctx, {
          branchId,
          productId: line.productId,
          quantity: line.stockQuantity,
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
          quantityChange: -line.stockQuantity,
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
      lines: lines.map(({ stockQuantity: _stockQuantity, ...line }) => line),
      paymentMethod: primaryTender,
      payments,
      ...tenderPaid,
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
      metadata: {
        invoiceNumber,
        total,
        branchId,
        completedAt,
        syncedAt,
        payments: payments.length > 1 || chargeOnAccount > 0 ? payments : undefined,
        stockShortages: stockShortages.length > 0 ? stockShortages : undefined,
      },
    });

    await bumpOrgSaleStats(ctx, profile.organizationId, {
      revenue: total,
      completedAt,
    });

    return { saleId, invoiceNumber, total, receiptPayload: payload };
  },
});

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
      throw new ConvexError("Forbidden: branch access denied");
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
      throw new ConvexError("End date must be on or after the start date");
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
      throw new ConvexError("Maximum amount must be at least the minimum");
    }

    let cashierFilter: Id<"users"> | undefined =
      profile.role === "cashier" ? userId : args.cashierId;
    if (profile.role !== "cashier" && args.cashierId) {
      const target = await getProfileByUserId(ctx, args.cashierId);
      if (!target || target.organizationId !== organizationId) {
        throw new ConvexError("Cashier not found");
      }
      if (profile.role === "manager" && target.branchId !== profile.branchId) {
        throw new ConvexError("Forbidden");
      }
      cashierFilter = args.cashierId;
    }

    const startDate = args.startDate;
    const endDate = args.endDate;
    const fetchCap = Math.min(Math.max(limit * 8, 400), 2000);
    let sales: Doc<"sales">[];
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

    async function refundedAmountsForSales(saleIds: Array<(typeof sales)[number]["_id"]>) {
      const refundedBySale = new Map<Id<"sales">, number>();
      await Promise.all(
        saleIds.map(async (saleId) => {
          const rows = await ctx.db
            .query("saleReturns")
            .withIndex("by_sale", (q) => q.eq("saleId", saleId))
            .collect();
          let sum = 0;
          for (const row of rows) {
            if (row.status !== "completed") continue;
            sum += row.refundAmount;
          }
          if (sum > 0) refundedBySale.set(saleId, sum);
        }),
      );
      return refundedBySale;
    }

    let refundedBySale = new Map<Id<"sales">, number>();
    if (args.returnStatus === "none" || args.returnStatus === "returned") {
      refundedBySale = await refundedAmountsForSales(sales.map((s) => s._id));
      if (args.returnStatus === "none") {
        sales = sales.filter((s) => (refundedBySale.get(s._id) ?? 0) === 0);
      } else {
        sales = sales.filter((s) => (refundedBySale.get(s._id) ?? 0) > 0);
      }
    }

    // Cashier-name search needs profile names for the candidate set only.
    let nameByUser = new Map<string, string>();
    if (args.search?.trim()) {
      const cashierIds = [...new Set(sales.map((s) => s.cashierId))];
      await Promise.all(
        cashierIds.map(async (cashierId) => {
          const profileRow = await ctx.db
            .query("profiles")
            .withIndex("by_userId", (q) => q.eq("userId", cashierId))
            .unique();
          if (profileRow && profileRow.organizationId === organizationId) {
            nameByUser.set(cashierId, profileRow.name);
          }
        }),
      );
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

    const page = sales.sort((a, b) => b.completedAt - a.completedAt).slice(0, limit);

    if (args.returnStatus !== "none" && args.returnStatus !== "returned") {
      refundedBySale = await refundedAmountsForSales(page.map((s) => s._id));
    }

    const pageCashierIds = [...new Set(page.map((s) => s.cashierId))];
    const pageBranchIds = [
      ...new Set(
        page.map((s) => s.branchId).filter((id): id is NonNullable<typeof id> => Boolean(id)),
      ),
    ];
    nameByUser = new Map();
    const branchName = new Map<Id<"branches">, string>();
    await Promise.all([
      ...pageCashierIds.map(async (cashierId) => {
        const profileRow = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", cashierId))
          .unique();
        if (profileRow && profileRow.organizationId === organizationId) {
          nameByUser.set(cashierId, profileRow.name);
        }
      }),
      ...pageBranchIds.map(async (branchId) => {
        const branch = await ctx.db.get(branchId);
        if (branch && branch.organizationId === organizationId) {
          branchName.set(branchId, branch.name);
        }
      }),
    ]);

    return page.map((sale) => ({
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
      amountPaid: sale.amountPaid,
      changeGiven: sale.changeGiven,
      status: sale.status,
      completedAt: sale.completedAt,
      syncedAt: sale.syncedAt ?? null,
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
      if (sale.cashierId !== userId) throw new ConvexError("Forbidden");
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

    const salePayments = await loadSalePayments(ctx, sale);
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
      payments: salePayments,
      ...(typeof sale.amountPaid === "number"
        ? { amountPaid: sale.amountPaid, changeGiven: sale.changeGiven ?? 0 }
        : typeof parsed?.amountPaid === "number"
          ? {
              amountPaid: parsed.amountPaid as number,
              changeGiven:
                typeof parsed.changeGiven === "number" ? (parsed.changeGiven as number) : 0,
            }
          : {}),
      completedAt: sale.completedAt,
      syncedAt: sale.syncedAt ?? null,
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
      payments: salePayments,
      amountPaid: sale.amountPaid,
      changeGiven: sale.changeGiven,
      status: sale.status,
      completedAt: sale.completedAt,
      syncedAt: sale.syncedAt ?? null,
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
