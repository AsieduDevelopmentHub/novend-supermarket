import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  assertBranchAccess,
  assertOrgDoc,
  canManageCatalog,
  canViewCostPrice,
  requireBranchId,
  requireRole,
  resolveBranchFilter,
} from "./shared/permissions";
import { assertOrganizationCapacity, assertOrganizationFeature } from "./shared/entitlements";
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
  const existing = await ctx.db
    .query("products")
    .withIndex("by_organization_barcode", (q) =>
      q.eq("organizationId", organizationId).eq("barcode", barcode),
    )
    .unique();
  if (existing && existing._id !== excludeId) throw new Error(BARCODE_TAKEN);
}
import { writeAuditLog } from "./shared/audit";
import { bumpOrgProductCount, productCountsTowardUsage } from "./shared/organizationStats";
import {
  ensureBranchStockRow,
  getBranchQuantity,
  stockMapForBranch,
  stockMapOrgWide,
} from "./shared/branchStock";
import {
  applyInventoryMovement,
  convertOnHandToOpeningLots,
  deriveExpiryListFields,
  increaseLot,
  lotSummaries,
  productExpiryAlertDays,
  remainingLotQuantity,
} from "./shared/lots";
import { loadProductImagesPolicy, loadBusinessConfiguration, loadExpiryPolicy } from "./settings";
import { assertProductImageUploadsEnabled } from "./shared/productImagesPolicy";
import { hasBusinessCapability } from "./shared/businessCapabilities";
import { isValidExpiryAlertDays } from "./shared/expiryPolicy";
import {
  formatVariantLabel,
  sanitizeCustomValues,
  sanitizeVariantAttributes,
} from "./shared/productVariants";

const variantAttributeValidator = v.object({ key: v.string(), value: v.string() });
const customValueValidator = v.object({ key: v.string(), value: v.string() });

/** null/undefined → org default (field unset). Number → product override. */
function parseExpiryAlertOverride(value: number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const days = Math.floor(value);
  if (!isValidExpiryAlertDays(days)) {
    throw new Error("Invalid expiry alert days");
  }
  return days;
}

export const listProducts = query({
  args: {
    search: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    includeInactive: v.optional(v.boolean()),
    branchId: v.optional(v.id("branches")),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
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

    products.sort((a, b) => a.name.localeCompare(b.name));
    const total = products.length;
    const pageSize = args.pageSize && args.pageSize > 0 ? Math.min(args.pageSize, 100) : total;
    const page =
      pageSize > 0
        ? Math.min(Math.max(args.page ?? 1, 1), Math.max(1, Math.ceil(total / pageSize)))
        : 1;
    const pageRows =
      pageSize > 0 ? products.slice((page - 1) * pageSize, page * pageSize) : products;

    const branchId = resolveBranchFilter(profile, args.branchId ?? null);
    const stockByProduct = branchId
      ? await stockMapForBranch(ctx, branchId)
      : await stockMapOrgWide(ctx, organizationId);
    const expiryPolicy = await loadExpiryPolicy(ctx, organizationId);
    const orgAlertDays = expiryPolicy.defaultAlertDays;
    const alertDaysByProduct = new Map(
      pageRows.map((p) => [String(p._id), productExpiryAlertDays(p, orgAlertDays)]),
    );
    const summaries = await lotSummaries(ctx, branchId, organizationId, alertDaysByProduct);

    const showCost = canViewCostPrice(profile);
    const items = await Promise.all(
      pageRows.map(async (product) => {
        const imageUrl = product.imageStorageId
          ? await ctx.storage.getUrl(product.imageStorageId)
          : null;
        const stockQuantity = stockByProduct.get(product._id) ?? 0;
        const expiry = deriveExpiryListFields(
          product,
          stockQuantity,
          summaries.get(product._id),
          orgAlertDays,
        );
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
          tracksInventory: product.tracksInventory !== false,
          sellableQuantity: expiry.sellableQuantity,
          expiredQuantity: expiry.expiredQuantity,
          nearestExpiry: expiry.nearestExpiry,
          isExpired: expiry.isExpired,
          isExpiring: expiry.isExpiring,
        };
      }),
    );
    return { items, total, page, pageSize: pageSize || total };
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
    const expiryPolicy = await loadExpiryPolicy(ctx, organizationId);
    const orgAlertDays = expiryPolicy.defaultAlertDays;
    const alertDaysByProduct = new Map([
      [String(product._id), productExpiryAlertDays(product, orgAlertDays)],
    ]);
    const summaries = await lotSummaries(ctx, branchId, organizationId, alertDaysByProduct);
    const expiry = deriveExpiryListFields(
      product,
      stockQuantity,
      summaries.get(product._id),
      orgAlertDays,
    );
    return {
      ...product,
      id: product._id,
      categoryName: category?.name ?? "Uncategorized",
      costPrice: canViewCostPrice(profile) ? product.costPrice : undefined,
      stockQuantity,
      imageUrl,
      branchId,
      tracksExpiry: expiry.tracksExpiry,
      tracksInventory: product.tracksInventory !== false,
      /** Effective alert window (org default or product override). */
      expiryAlertDays: expiry.expiryAlertDays ?? orgAlertDays,
      /** Stored product override; null means use organization default. */
      expiryAlertDaysOverride:
        typeof product.expiryAlertDays === "number" ? product.expiryAlertDays : null,
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
    assertProductImageUploadsEnabled(await loadProductImagesPolicy(ctx, organizationId));
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
    sellUnits: v.optional(
      v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          factorToBase: v.number(),
          barcode: v.optional(v.string()),
          sellingPrice: v.optional(v.number()),
          active: v.boolean(),
        }),
      ),
    ),
    pricingMode: v.optional(v.union(v.literal("fixed"), v.literal("per_weight"))),
    lowStockThreshold: v.number(),
    status: v.union(v.literal("active"), v.literal("inactive")),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    branchId: v.optional(v.id("branches")),
    tracksExpiry: v.optional(v.boolean()),
    /** null = use organization default; number = product override. */
    expiryAlertDays: v.optional(v.union(v.number(), v.null())),
    expiryDate: v.optional(v.string()),
    tracksInventory: v.optional(v.boolean()),
    isVariantParent: v.optional(v.boolean()),
    parentProductId: v.optional(v.id("products")),
    variantAttributes: v.optional(v.array(variantAttributeValidator)),
    tracksSerials: v.optional(v.boolean()),
    customValues: v.optional(v.array(customValueValidator)),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId, organization } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    if (!canManageCatalog(profile)) throw new Error("Forbidden");
    await assertOrganizationCapacity(ctx, organization, "products");

    const businessConfig = await loadBusinessConfiguration(ctx, organizationId);
    const variantsOn = hasBusinessCapability(businessConfig, "product_variants");
    const serialsOn = hasBusinessCapability(businessConfig, "serial_tracking");
    const customOn = hasBusinessCapability(businessConfig, "custom_fields");
    const nonStockAllowed = hasBusinessCapability(businessConfig, "non_stock_sales");
    if (args.tracksInventory === false && !nonStockAllowed) {
      throw new Error("Non-stock catalogue is not enabled for this organization");
    }
    if (args.isVariantParent || args.parentProductId || args.variantAttributes?.length) {
      if (!variantsOn) throw new Error("Product variants are not enabled for this organization");
    }
    if (args.tracksSerials && !serialsOn) {
      throw new Error("Serial tracking is not enabled for this organization");
    }
    if (args.customValues?.length && !customOn) {
      throw new Error("Custom fields are not enabled for this organization");
    }
    const tracksInventory =
      nonStockAllowed && args.tracksInventory === false ? false : true;
    const isVariantParent = variantsOn && args.isVariantParent === true;
    let parentProductId: Id<"products"> | undefined;
    let variantAttributes = sanitizeVariantAttributes(args.variantAttributes);
    let variantLabel: string | undefined;
    if (args.parentProductId) {
      if (isVariantParent) throw new Error("A parent product cannot also be a variant");
      const parent = await ctx.db.get(args.parentProductId);
      if (!parent || parent.organizationId !== organizationId || parent.isVariantParent !== true) {
        throw new Error("Parent product not found");
      }
      parentProductId = parent._id;
      if (variantAttributes.length === 0) {
        throw new Error("Add at least one variant attribute (e.g. size or color)");
      }
      variantLabel = formatVariantLabel(variantAttributes);
    } else if (isVariantParent) {
      variantAttributes = [];
    }
    const tracksSerials = serialsOn && args.tracksSerials === true && !isVariantParent;
    const customValues = customOn ? sanitizeCustomValues(args.customValues) : [];
    // Parents hold no sellable stock — force zero initial qty.
    const forceZeroStock = isVariantParent;

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
    const tracksExpiry = tracksInventory && args.tracksExpiry === true;
    let expiryAlertDays: number | undefined;
    if (tracksExpiry) {
      expiryAlertDays = parseExpiryAlertOverride(args.expiryAlertDays);
    }
    const initial = forceZeroStock ? 0 : Math.floor(args.stockQuantity);
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
      assertProductImageUploadsEnabled(await loadProductImagesPolicy(ctx, organizationId));
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
      sellUnits: args.sellUnits,
      pricingMode: args.pricingMode,
      lowStockThreshold: Math.floor(args.lowStockThreshold),
      tracksExpiry: tracksExpiry || undefined,
      expiryAlertDays,
      tracksInventory: tracksInventory ? undefined : false,
      isVariantParent: isVariantParent || undefined,
      parentProductId,
      variantLabel,
      variantAttributes: variantAttributes.length ? variantAttributes : undefined,
      tracksSerials: tracksSerials || undefined,
      customValues: customValues.length ? customValues : undefined,
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

    if (productCountsTowardUsage(args.status)) {
      await bumpOrgProductCount(ctx, organizationId, 1);
    }

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
    sellUnits: v.optional(
      v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          factorToBase: v.number(),
          barcode: v.optional(v.string()),
          sellingPrice: v.optional(v.number()),
          active: v.boolean(),
        }),
      ),
    ),
    pricingMode: v.optional(v.union(v.literal("fixed"), v.literal("per_weight"))),
    lowStockThreshold: v.number(),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("archived")),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    clearImage: v.optional(v.boolean()),
    tracksExpiry: v.optional(v.boolean()),
    /** null = use organization default; number = product override. */
    expiryAlertDays: v.optional(v.union(v.number(), v.null())),
    openingExpiryDate: v.optional(v.string()),
    tracksInventory: v.optional(v.boolean()),
    isVariantParent: v.optional(v.boolean()),
    parentProductId: v.optional(v.union(v.id("products"), v.null())),
    variantAttributes: v.optional(v.array(variantAttributeValidator)),
    tracksSerials: v.optional(v.boolean()),
    customValues: v.optional(v.array(customValueValidator)),
    /** Absolute branch stock — only when products.editStock entitlement is on. */
    stockQuantity: v.optional(v.number()),
    /** Branch to set stock on (defaults to the actor’s working branch). */
    stockBranchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId, organization } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    if (!canManageCatalog(profile)) throw new Error("Forbidden");
    const product = await ctx.db.get(args.id);
    if (!product || product.organizationId !== organizationId) throw new Error("Product not found");

    const businessConfig = await loadBusinessConfiguration(ctx, organizationId);
    const variantsOn = hasBusinessCapability(businessConfig, "product_variants");
    const serialsOn = hasBusinessCapability(businessConfig, "serial_tracking");
    const customOn = hasBusinessCapability(businessConfig, "custom_fields");
    const nonStockAllowed = hasBusinessCapability(businessConfig, "non_stock_sales");
    if (args.tracksInventory === false && !nonStockAllowed) {
      throw new Error("Non-stock catalogue is not enabled for this organization");
    }
    if (
      (args.isVariantParent !== undefined ||
        args.parentProductId !== undefined ||
        args.variantAttributes !== undefined) &&
      !variantsOn
    ) {
      throw new Error("Product variants are not enabled for this organization");
    }
    if (args.tracksSerials && !serialsOn) {
      throw new Error("Serial tracking is not enabled for this organization");
    }
    if (args.customValues !== undefined && !customOn) {
      throw new Error("Custom fields are not enabled for this organization");
    }
    const tracksInventory =
      nonStockAllowed && args.tracksInventory === false ? false : true;
    const isVariantParent =
      variantsOn &&
      (args.isVariantParent !== undefined
        ? args.isVariantParent === true
        : product.isVariantParent === true);
    let parentProductId =
      args.parentProductId === null
        ? undefined
        : (args.parentProductId ?? product.parentProductId);
    let variantAttributes =
      args.variantAttributes !== undefined
        ? sanitizeVariantAttributes(args.variantAttributes)
        : sanitizeVariantAttributes(product.variantAttributes);
    let variantLabel = product.variantLabel;
    if (isVariantParent) {
      parentProductId = undefined;
      variantAttributes = [];
      variantLabel = undefined;
    } else if (parentProductId) {
      const parent = await ctx.db.get(parentProductId);
      if (!parent || parent.organizationId !== organizationId || parent.isVariantParent !== true) {
        throw new Error("Parent product not found");
      }
      if (variantAttributes.length === 0) {
        throw new Error("Add at least one variant attribute (e.g. size or color)");
      }
      variantLabel = formatVariantLabel(variantAttributes);
    }
    const tracksSerials =
      serialsOn && (args.tracksSerials ?? product.tracksSerials === true) && !isVariantParent;
    const customValues =
      args.customValues !== undefined
        ? sanitizeCustomValues(args.customValues)
        : sanitizeCustomValues(product.customValues);

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

    const tracksExpiry = tracksInventory && args.tracksExpiry === true;
    let expiryAlertDays: number | undefined;
    if (tracksExpiry) {
      expiryAlertDays = parseExpiryAlertOverride(args.expiryAlertDays);
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

    if (args.stockQuantity !== undefined) {
      if (!Number.isFinite(args.stockQuantity) || args.stockQuantity < 0) {
        throw new Error("Invalid stock quantity");
      }
      const target = Math.floor(args.stockQuantity);
      const { branchId } = await requireBranchId(ctx, args.stockBranchId ?? null);
      assertBranchAccess(profile, branchId);
      const current = await getBranchQuantity(ctx, branchId, args.id);
      const delta = target - current;
      if (delta !== 0) {
        await assertOrganizationFeature(ctx, organization, "products.editStock");
        if (tracksExpiry || product.tracksExpiry === true) {
          throw new Error("Use Inventory or Expiry lots to change stock on dated products");
        }
        await applyInventoryMovement(ctx, {
          product,
          branchId,
          quantityChange: delta,
          reason: "adjustment",
          note: "Set from product edit",
          performedBy: userId,
        });
        const nextOnHand = await getBranchQuantity(ctx, branchId, args.id);
        await ctx.db.patch(args.id, { stockQuantity: nextOnHand });
      }
    }

    let imageStorageId = product.imageStorageId;
    if (args.clearImage) {
      imageStorageId = undefined;
    } else if (args.imageStorageId) {
      assertProductImageUploadsEnabled(await loadProductImagesPolicy(ctx, organizationId));
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
      sellUnits: args.sellUnits,
      pricingMode: args.pricingMode,
      lowStockThreshold: Math.floor(args.lowStockThreshold),
      tracksExpiry,
      expiryAlertDays,
      tracksInventory: tracksInventory ? undefined : false,
      isVariantParent: isVariantParent || undefined,
      parentProductId,
      variantLabel,
      variantAttributes: variantAttributes.length ? variantAttributes : undefined,
      tracksSerials: tracksSerials || undefined,
      customValues: customValues.length ? customValues : undefined,
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

    const wasCounted = productCountsTowardUsage(product.status);
    const nowCounted = productCountsTowardUsage(args.status);
    if (wasCounted !== nowCounted) {
      await bumpOrgProductCount(ctx, organizationId, nowCounted ? 1 : -1);
    }

    return args.id;
  },
});

/** Active sellable children of a variant parent (POS picker). */
export const listVariantsByParent = query({
  args: {
    parentProductId: v.id("products"),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { profile, branchId } = await requireBranchId(ctx, args.branchId);
    const parent = await ctx.db.get(args.parentProductId);
    if (!parent || parent.organizationId !== profile.organizationId) {
      throw new Error("Product not found");
    }
    const children = await ctx.db
      .query("products")
      .withIndex("by_organization_parent", (q) =>
        q.eq("organizationId", profile.organizationId).eq("parentProductId", args.parentProductId),
      )
      .collect();
    const stock = await stockMapForBranch(ctx, branchId);
    return children
      .filter((row) => row.status === "active")
      .map((row) => ({
        id: row._id,
        name: row.name,
        sku: row.sku,
        barcode: row.barcode ?? null,
        sellingPrice: row.sellingPrice,
        costPrice: canViewCostPrice(profile) ? row.costPrice : 0,
        stockQuantity: stock.get(row._id) ?? 0,
        unit: row.unit,
        variantLabel: row.variantLabel ?? null,
        variantAttributes: row.variantAttributes ?? [],
        tracksSerials: row.tracksSerials === true,
        tracksInventory: row.tracksInventory !== false,
      }))
      .sort((a, b) => (a.variantLabel ?? a.sku).localeCompare(b.variantLabel ?? b.sku));
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
    if (productCountsTowardUsage(product.status)) {
      await bumpOrgProductCount(ctx, organizationId, -1);
    }
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "archive_product",
      entityType: "products",
      entityId: args.id,
    });
  },
});
