import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  assertBranchAccess,
  assertOrgDoc,
  canManageCatalog,
  canViewCostPrice,
  requireRole,
  resolveBranchFilter,
} from "./shared/permissions";
import { assertOrganizationCapacity } from "./shared/entitlements";
import { assertOwnedStorage, beginStorageUploadSession } from "./shared/storageSessions";
import {
  assertPositiveMoney,
  assertStoredImage,
  roundMoney,
  productMatchesLookup,
  sanitizeBarcode,
  sanitizeOptionalText,
  sanitizeSku,
  sanitizeText,
  TEXT_LIMITS,
} from "./shared/validation";

const BARCODE_TAKEN = "This barcode is already assigned to another product in your organization.";

async function assertUniqueBarcode(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  barcode: string | undefined,
  excludeId?: Id<"products">,
) {
  if (!barcode) return;
  const products = await ctx.db
    .query("products")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();
  const clash = products.find(
    (p) =>
      p._id !== excludeId &&
      Boolean(p.barcode) &&
      p.barcode!.toLowerCase() === barcode.toLowerCase(),
  );
  if (clash) throw new Error(BARCODE_TAKEN);
}
import { writeAuditLog } from "./shared/audit";
import { ensureBranchStockRow, stockMapForBranch, stockMapOrgWide } from "./shared/branchStock";
import {
  convertOnHandToOpeningLots,
  DEFAULT_EXPIRY_ALERT_DAYS,
  deriveExpiryListFields,
  increaseLot,
  lotSummaries,
  remainingLotQuantity,
} from "./shared/lots";

export const listProducts = query({
  args: {
    search: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    includeInactive: v.optional(v.boolean()),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const categoryMap = new Map(categories.map((c) => [c._id, c.name]));

    let products = await ctx.db
      .query("products")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    if (!args.includeInactive) {
      products = products.filter((p) => p.status === "active");
    } else {
      products = products.filter((p) => p.status !== "archived");
    }
    if (args.categoryId) {
      products = products.filter((p) => p.categoryId === args.categoryId);
    }
    if (args.search?.trim()) {
      products = products.filter((p) =>
        productMatchesLookup({ name: p.name, sku: p.sku, barcode: p.barcode }, args.search!),
      );
    }

    const branchId = resolveBranchFilter(profile, args.branchId ?? null);
    const stockByProduct = branchId
      ? await stockMapForBranch(ctx, branchId)
      : await stockMapOrgWide(ctx, organizationId);
    const summaries = await lotSummaries(ctx, branchId, organizationId);

    const showCost = canViewCostPrice(profile);
    return await Promise.all(
      products
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(async (product) => {
          const imageUrl = product.imageStorageId
            ? await ctx.storage.getUrl(product.imageStorageId)
            : null;
          const stockQuantity = stockByProduct.get(product._id) ?? 0;
          const expiry = deriveExpiryListFields(product, stockQuantity, summaries.get(product._id));
          return {
            id: product._id,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            categoryId: product.categoryId,
            categoryName: categoryMap.get(product.categoryId) ?? "Uncategorized",
            sellingPrice: product.sellingPrice,
            costPrice: showCost ? product.costPrice : undefined,
            stockQuantity,
            unit: product.unit,
            lowStockThreshold: product.lowStockThreshold,
            status: product.status,
            description: product.description,
            imageUrl,
            isLowStock: expiry.isLowStock,
            branchId,
            tracksExpiry: expiry.tracksExpiry,
            sellableQuantity: expiry.sellableQuantity,
            expiredQuantity: expiry.expiredQuantity,
            nearestExpiry: expiry.nearestExpiry,
            isExpired: expiry.isExpired,
            isExpiring: expiry.isExpiring,
          };
        }),
    );
  },
});

export const getProduct = query({
  args: {
    id: v.id("products"),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const product = await ctx.db.get(args.id);
    if (!product || product.organizationId !== organizationId) return null;
    const category = await ctx.db.get(product.categoryId);
    const imageUrl = product.imageStorageId
      ? await ctx.storage.getUrl(product.imageStorageId)
      : null;
    const branchId = resolveBranchFilter(profile, args.branchId ?? null);
    const stockQuantity = branchId
      ? ((await stockMapForBranch(ctx, branchId)).get(product._id) ?? 0)
      : ((await stockMapOrgWide(ctx, organizationId)).get(product._id) ?? 0);
    const summaries = await lotSummaries(ctx, branchId, organizationId);
    const expiry = deriveExpiryListFields(product, stockQuantity, summaries.get(product._id));
    return {
      ...product,
      id: product._id,
      categoryName: category?.name ?? "Uncategorized",
      costPrice: canViewCostPrice(profile) ? product.costPrice : undefined,
      stockQuantity,
      imageUrl,
      branchId,
      tracksExpiry: expiry.tracksExpiry,
      expiryAlertDays: expiry.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS,
      sellableQuantity: expiry.sellableQuantity,
      expiredQuantity: expiry.expiredQuantity,
      nearestExpiry: expiry.nearestExpiry,
      isExpired: expiry.isExpired,
      isExpiring: expiry.isExpiring,
      isLowStock: expiry.isLowStock,
    };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    if (!canManageCatalog(profile)) throw new Error("Forbidden");
    const sessionId = await beginStorageUploadSession(ctx, {
      organizationId,
      userId,
      purpose: "productImage",
    });
    return { uploadUrl: await ctx.storage.generateUploadUrl(), sessionId };
  },
});

export const createProduct = mutation({
  args: {
    name: v.string(),
    sku: v.string(),
    barcode: v.optional(v.string()),
    categoryId: v.id("categories"),
    costPrice: v.number(),
    sellingPrice: v.number(),
    stockQuantity: v.number(),
    unit: v.string(),
    lowStockThreshold: v.number(),
    status: v.union(v.literal("active"), v.literal("inactive")),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    branchId: v.optional(v.id("branches")),
    tracksExpiry: v.optional(v.boolean()),
    expiryAlertDays: v.optional(v.number()),
    expiryDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId, organization } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    if (!canManageCatalog(profile)) throw new Error("Forbidden");
    await assertOrganizationCapacity(ctx, organization, "products");

    const name = sanitizeText(args.name, "Product name", TEXT_LIMITS.name);
    const sku = sanitizeSku(args.sku);
    const barcode = sanitizeBarcode(args.barcode);
    assertPositiveMoney(args.costPrice, "cost price");
    assertPositiveMoney(args.sellingPrice, "selling price");
    if (!Number.isFinite(args.stockQuantity) || args.stockQuantity < 0) {
      throw new Error("Invalid stock quantity");
    }
    if (!Number.isFinite(args.lowStockThreshold) || args.lowStockThreshold < 0) {
      throw new Error("Invalid low stock threshold");
    }
    const tracksExpiry = args.tracksExpiry === true;
    let expiryAlertDays: number | undefined;
    if (tracksExpiry) {
      expiryAlertDays = Math.floor(args.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS);
      if (!Number.isFinite(expiryAlertDays) || expiryAlertDays < 0 || expiryAlertDays > 3650) {
        throw new Error("Invalid expiry alert days");
      }
    }
    const initial = Math.floor(args.stockQuantity);
    if (tracksExpiry && initial > 0 && !args.expiryDate) {
      throw new Error("Expiry date is required when tracking expiry on initial stock");
    }

    const branchId = args.branchId ?? profile.branchId;
    if (!branchId) throw new Error("Branch is required for initial stock");
    assertBranchAccess(profile, branchId);

    const existingSku = await ctx.db
      .query("products")
      .withIndex("by_organization_sku", (q) =>
        q.eq("organizationId", organizationId).eq("sku", sku),
      )
      .unique();
    if (existingSku) throw new Error("SKU already exists");
    await assertUniqueBarcode(ctx, organizationId, barcode);

    const category = await ctx.db.get(args.categoryId);
    if (!category || !category.isActive || category.organizationId !== organizationId) {
      throw new Error("Invalid category");
    }

    if (args.imageStorageId) {
      await assertStoredImage(ctx, args.imageStorageId);
      await assertOwnedStorage(ctx, args.imageStorageId, organizationId);
    }

    const unit = sanitizeText(args.unit || "units", "Unit", TEXT_LIMITS.unit);
    const description = sanitizeOptionalText(
      args.description,
      "Description",
      TEXT_LIMITS.description,
    );

    const id = await ctx.db.insert("products", {
      organizationId,
      name,
      sku,
      barcode,
      categoryId: args.categoryId,
      costPrice: roundMoney(args.costPrice),
      sellingPrice: roundMoney(args.sellingPrice),
      stockQuantity: initial,
      unit,
      lowStockThreshold: Math.floor(args.lowStockThreshold),
      tracksExpiry: tracksExpiry || undefined,
      expiryAlertDays,
      status: args.status,
      description,
      imageStorageId: args.imageStorageId,
    });

    // Zero stock at all active branches; seed quantity on the selected branch.
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    for (const branch of branches.filter((b) => b.status === "active")) {
      const qty = branch._id === branchId ? initial : 0;
      if (qty > 0 && tracksExpiry && args.expiryDate) {
        await ensureBranchStockRow(ctx, branch._id, id, 0);
        await increaseLot(ctx, {
          branchId: branch._id,
          productId: id,
          quantity: qty,
          expiryDate: args.expiryDate,
          reason: "receive",
          performedBy: userId,
          note: "Initial stock on product create",
        });
      } else {
        await ensureBranchStockRow(ctx, branch._id, id, qty);
        if (qty > 0) {
          await ctx.db.insert("inventoryHistory", {
            organizationId,
            productId: id,
            branchId: branch._id,
            quantityChange: qty,
            quantityAfter: qty,
            reason: "receive",
            note: "Initial stock on product create",
            performedBy: userId,
          });
        }
      }
    }

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "create_product",
      entityType: "products",
      entityId: id,
      metadata: { branchId },
    });

    return id;
  },
});

export const updateProduct = mutation({
  args: {
    id: v.id("products"),
    name: v.string(),
    sku: v.string(),
    barcode: v.optional(v.string()),
    categoryId: v.id("categories"),
    costPrice: v.number(),
    sellingPrice: v.number(),
    unit: v.string(),
    lowStockThreshold: v.number(),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("archived")),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    clearImage: v.optional(v.boolean()),
    tracksExpiry: v.optional(v.boolean()),
    expiryAlertDays: v.optional(v.number()),
    openingExpiryDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    if (!canManageCatalog(profile)) throw new Error("Forbidden");
    const product = await ctx.db.get(args.id);
    if (!product || product.organizationId !== organizationId) throw new Error("Product not found");

    const name = sanitizeText(args.name, "Product name", TEXT_LIMITS.name);
    const sku = sanitizeSku(args.sku);
    const barcode = sanitizeBarcode(args.barcode);
    assertPositiveMoney(args.costPrice, "cost price");
    assertPositiveMoney(args.sellingPrice, "selling price");

    const existingSku = await ctx.db
      .query("products")
      .withIndex("by_organization_sku", (q) =>
        q.eq("organizationId", organizationId).eq("sku", sku),
      )
      .unique();
    if (existingSku && existingSku._id !== args.id) {
      throw new Error("SKU already exists");
    }
    await assertUniqueBarcode(ctx, organizationId, barcode, args.id);

    const category = await ctx.db.get(args.categoryId);
    if (!category || category.organizationId !== organizationId)
      throw new Error("Invalid category");

    if (!Number.isFinite(args.lowStockThreshold) || args.lowStockThreshold < 0) {
      throw new Error("Invalid low stock threshold");
    }

    const tracksExpiry = args.tracksExpiry === true;
    let expiryAlertDays: number | undefined;
    if (tracksExpiry) {
      expiryAlertDays = Math.floor(args.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS);
      if (!Number.isFinite(expiryAlertDays) || expiryAlertDays < 0 || expiryAlertDays > 3650) {
        throw new Error("Invalid expiry alert days");
      }
    }

    const wasTracking = product.tracksExpiry === true;
    if (tracksExpiry && !wasTracking) {
      const onHand = await remainingLotQuantity(ctx, args.id);
      const stockRows = await ctx.db
        .query("branchStock")
        .withIndex("by_product", (q) => q.eq("productId", args.id))
        .collect();
      const physical = stockRows.reduce((sum, row) => sum + row.quantity, 0);
      if (physical > 0 && onHand <= 0) {
        if (!args.openingExpiryDate) {
          throw new Error("Expiry date is required to convert existing stock into lots");
        }
        await convertOnHandToOpeningLots(ctx, {
          productId: args.id,
          expiryDate: args.openingExpiryDate,
          performedBy: userId,
        });
      }
    }
    if (!tracksExpiry && wasTracking) {
      const remaining = await remainingLotQuantity(ctx, args.id);
      if (remaining > 0) {
        throw new Error(
          "Write off or sell remaining dated stock before turning off expiry tracking",
        );
      }
    }

    let imageStorageId = product.imageStorageId;
    if (args.clearImage) {
      imageStorageId = undefined;
    } else if (args.imageStorageId) {
      await assertStoredImage(ctx, args.imageStorageId);
      await assertOwnedStorage(ctx, args.imageStorageId, organizationId);
      imageStorageId = args.imageStorageId;
    }

    await ctx.db.patch(args.id, {
      name,
      sku,
      barcode,
      categoryId: args.categoryId,
      costPrice: roundMoney(args.costPrice),
      sellingPrice: roundMoney(args.sellingPrice),
      unit: sanitizeText(args.unit || product.unit, "Unit", TEXT_LIMITS.unit),
      lowStockThreshold: Math.floor(args.lowStockThreshold),
      tracksExpiry,
      expiryAlertDays,
      status: args.status,
      description: sanitizeOptionalText(args.description, "Description", TEXT_LIMITS.description),
      imageStorageId,
    });
    if (product.imageStorageId && product.imageStorageId !== imageStorageId) {
      try {
        await ctx.storage.delete(product.imageStorageId);
      } catch {
        /* best-effort cleanup; metadata no longer references the blob */
      }
    }

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_product",
      entityType: "products",
      entityId: args.id,
    });

    return args.id;
  },
});

export const archiveProduct = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    if (!canManageCatalog(profile)) throw new Error("Forbidden");
    const product = await ctx.db.get(args.id);
    assertOrgDoc(product, organizationId);
    await ctx.db.patch(args.id, { status: "archived" });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "archive_product",
      entityType: "products",
      entityId: args.id,
    });
  },
});
