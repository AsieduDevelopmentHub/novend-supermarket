/**
 * Super Admin CRUD for the public plan catalog + billing display settings.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformAdmin } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import {
  MIN_MONTHLY_PRICE_GHS,
  MIN_PRODUCT_LIMIT,
  clampListPriceMarkupPercent,
  isSeedPlanKey,
  isValidPlanKeySlug,
  listPriceFromReal,
  yearlyPriceFromMonthly,
} from "./shared/plans";
import { ensureBillingSettingsRow, ensurePlanCatalogRows } from "./shared/subscriptions";
import { internal } from "./_generated/api";

const MAX_HOMEPAGE_HIGHLIGHTS = 3;

function assertMonthlyFloor(monthly: number | null, priceFrom: boolean) {
  if (monthly === null) return;
  if (!Number.isFinite(monthly) || monthly < MIN_MONTHLY_PRICE_GHS) {
    throw new Error(`Monthly price must be at least GH₵${MIN_MONTHLY_PRICE_GHS}.`);
  }
  if (priceFrom && monthly < MIN_MONTHLY_PRICE_GHS) {
    throw new Error(`Enterprise starting price must be at least GH₵${MIN_MONTHLY_PRICE_GHS}.`);
  }
}

function assertProductFloor(products: number | null, isUnlimitedTier: boolean) {
  if (products === null) return;
  if (!isUnlimitedTier && products < MIN_PRODUCT_LIMIT) {
    throw new Error(`Product limit must be at least ${MIN_PRODUCT_LIMIT} (or unlimited).`);
  }
}

export const listPlans = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx, "orgs.read");
    const rows = await ctx.db.query("plans").collect();
    const settings = await ctx.db
      .query("billingSettings")
      .withIndex("by_singleton", (q) => q.eq("singleton", true))
      .unique();
    const markup = settings?.listPriceMarkupPercent ?? 20;
    return {
      listPriceMarkupPercent: markup,
      currency: settings?.currency ?? "GHS",
      plans: rows
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => ({
          ...row,
          listMonthlyPrice:
            row.monthlyPrice != null ? listPriceFromReal(row.monthlyPrice, markup) : null,
          listYearlyPrice:
            row.yearlyPrice != null ? listPriceFromReal(row.yearlyPrice, markup) : null,
        })),
    };
  },
});

export const getBillingSettings = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx, "orgs.read");
    const row = await ctx.db
      .query("billingSettings")
      .withIndex("by_singleton", (q) => q.eq("singleton", true))
      .unique();
    return {
      listPriceMarkupPercent: row?.listPriceMarkupPercent ?? 20,
      currency: row?.currency ?? "GHS",
      updatedAt: row?.updatedAt ?? null,
    };
  },
});

export const updateBillingSettings = mutation({
  args: {
    listPriceMarkupPercent: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    await ensureBillingSettingsRow(ctx);
    const row = await ctx.db
      .query("billingSettings")
      .withIndex("by_singleton", (q) => q.eq("singleton", true))
      .unique();
    if (!row) throw new Error("Billing settings missing");
    const percent = clampListPriceMarkupPercent(args.listPriceMarkupPercent);
    await ctx.db.patch(row._id, {
      listPriceMarkupPercent: percent,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "billing_settings.update",
      entityType: "billingSettings",
      entityId: row._id,
      metadata: { listPriceMarkupPercent: percent },
    });
    return { listPriceMarkupPercent: percent };
  },
});

export const ensureCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    await ensurePlanCatalogRows(ctx);
    return { ok: true as const };
  },
});

export const createPlan = mutation({
  args: {
    key: v.string(),
    name: v.string(),
    tagline: v.string(),
    audience: v.optional(v.string()),
    monthlyPrice: v.number(),
    productLimit: v.union(v.number(), v.null()),
    userLimit: v.union(v.number(), v.null()),
    branchLimit: v.union(v.number(), v.null()),
    deviceLimit: v.union(v.number(), v.null()),
    backupLimitBytes: v.union(v.number(), v.null()),
    features: v.array(v.string()),
    priceFrom: v.optional(v.boolean()),
    variableBackup: v.optional(v.boolean()),
    featured: v.optional(v.boolean()),
    selfServe: v.optional(v.boolean()),
    marketingVisible: v.optional(v.boolean()),
    homepageHighlight: v.optional(v.boolean()),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const key = args.key.trim().toLowerCase();
    if (!isValidPlanKeySlug(key)) {
      throw new Error("Plan key must be a short slug (letters, numbers, underscore).");
    }
    if (isSeedPlanKey(key) || key === "lifetime") {
      throw new Error("That key is reserved. Choose a different slug.");
    }
    const existing = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) throw new Error("A plan with that key already exists.");

    const priceFrom = Boolean(args.priceFrom);
    assertMonthlyFloor(args.monthlyPrice, priceFrom);
    assertProductFloor(args.productLimit, args.productLimit === null);

    if (args.homepageHighlight) {
      await enforceHomepageCap(ctx, null);
    }

    const now = Date.now();
    const yearly = yearlyPriceFromMonthly(args.monthlyPrice);
    const id = await ctx.db.insert("plans", {
      key,
      name: args.name.trim(),
      description: args.tagline.trim(),
      tagline: args.tagline.trim(),
      audience: args.audience?.trim() || "",
      monthlyPrice: args.monthlyPrice,
      yearlyPrice: yearly,
      oneTimePrice: null,
      currency: "GHS",
      productLimit: args.productLimit,
      userLimit: args.userLimit,
      branchLimit: args.branchLimit,
      deviceLimit: args.deviceLimit,
      backupLimitBytes: args.backupLimitBytes,
      features: args.features.map((f) => f.trim()).filter(Boolean),
      isLifetime: false,
      priceFrom,
      variableBackup: Boolean(args.variableBackup),
      featured: Boolean(args.featured),
      selfServe: args.selfServe !== false,
      marketingVisible: args.marketingVisible !== false,
      homepageHighlight: Boolean(args.homepageHighlight),
      legacy: false,
      archived: false,
      sortOrder: args.sortOrder,
      updatedAt: now,
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "plan.create",
      entityType: "plans",
      entityId: id,
      metadata: { key },
    });

    await ctx.scheduler.runAfter(0, internal.billing.syncGatewayPlansInternal, {});
    return { id, key };
  },
});

export const updatePlan = mutation({
  args: {
    planId: v.id("plans"),
    name: v.optional(v.string()),
    tagline: v.optional(v.string()),
    audience: v.optional(v.string()),
    monthlyPrice: v.optional(v.union(v.number(), v.null())),
    yearlyPrice: v.optional(v.union(v.number(), v.null())),
    productLimit: v.optional(v.union(v.number(), v.null())),
    userLimit: v.optional(v.union(v.number(), v.null())),
    branchLimit: v.optional(v.union(v.number(), v.null())),
    deviceLimit: v.optional(v.union(v.number(), v.null())),
    backupLimitBytes: v.optional(v.union(v.number(), v.null())),
    features: v.optional(v.array(v.string())),
    priceFrom: v.optional(v.boolean()),
    variableBackup: v.optional(v.boolean()),
    featured: v.optional(v.boolean()),
    selfServe: v.optional(v.boolean()),
    marketingVisible: v.optional(v.boolean()),
    homepageHighlight: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const row = await ctx.db.get(args.planId);
    if (!row) throw new Error("Plan not found");
    if (row.isLifetime) throw new Error("Lifetime is legacy and cannot be edited here.");

    const priceFrom = args.priceFrom ?? row.priceFrom ?? false;
    const monthly =
      args.monthlyPrice !== undefined ? args.monthlyPrice : row.monthlyPrice;
    if (monthly != null) assertMonthlyFloor(monthly, priceFrom);

    const products =
      args.productLimit !== undefined ? args.productLimit : row.productLimit;
    assertProductFloor(products, products === null);

    if (args.homepageHighlight === true && !row.homepageHighlight) {
      await enforceHomepageCap(ctx, row._id);
    }

    const yearly =
      args.yearlyPrice !== undefined
        ? args.yearlyPrice
        : monthly != null
          ? yearlyPriceFromMonthly(monthly)
          : row.yearlyPrice;

    await ctx.db.patch(row._id, {
      name: args.name?.trim() ?? row.name,
      description: args.tagline?.trim() ?? row.description,
      tagline: args.tagline?.trim() ?? row.tagline,
      audience: args.audience?.trim() ?? row.audience,
      monthlyPrice: monthly,
      yearlyPrice: yearly,
      productLimit: products,
      userLimit: args.userLimit !== undefined ? args.userLimit : row.userLimit,
      branchLimit: args.branchLimit !== undefined ? args.branchLimit : row.branchLimit,
      deviceLimit: args.deviceLimit !== undefined ? args.deviceLimit : row.deviceLimit,
      backupLimitBytes:
        args.backupLimitBytes !== undefined ? args.backupLimitBytes : row.backupLimitBytes,
      features: args.features
        ? args.features.map((f) => f.trim()).filter(Boolean)
        : row.features,
      priceFrom,
      variableBackup: args.variableBackup ?? row.variableBackup,
      featured: args.featured ?? row.featured,
      selfServe: args.selfServe ?? row.selfServe,
      marketingVisible: args.marketingVisible ?? row.marketingVisible,
      homepageHighlight: args.homepageHighlight ?? row.homepageHighlight,
      sortOrder: args.sortOrder ?? row.sortOrder,
      updatedAt: Date.now(),
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "plan.update",
      entityType: "plans",
      entityId: row._id,
      metadata: { key: row.key },
    });

    if (args.monthlyPrice !== undefined || args.yearlyPrice !== undefined) {
      await ctx.scheduler.runAfter(0, internal.billing.syncGatewayPlansInternal, {});
    }
    return { ok: true as const };
  },
});

export const setPlanMarketing = mutation({
  args: {
    planId: v.id("plans"),
    marketingVisible: v.optional(v.boolean()),
    homepageHighlight: v.optional(v.boolean()),
    featured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const row = await ctx.db.get(args.planId);
    if (!row) throw new Error("Plan not found");
    if (args.homepageHighlight === true && !row.homepageHighlight) {
      await enforceHomepageCap(ctx, row._id);
    }
    await ctx.db.patch(row._id, {
      marketingVisible: args.marketingVisible ?? row.marketingVisible,
      homepageHighlight: args.homepageHighlight ?? row.homepageHighlight,
      featured: args.featured ?? row.featured,
      updatedAt: Date.now(),
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "plan.marketing",
      entityType: "plans",
      entityId: row._id,
      metadata: {
        marketingVisible: args.marketingVisible,
        homepageHighlight: args.homepageHighlight,
        featured: args.featured,
      },
    });
    return { ok: true as const };
  },
});

export const archivePlan = mutation({
  args: { planId: v.id("plans"), archived: v.boolean() },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const row = await ctx.db.get(args.planId);
    if (!row) throw new Error("Plan not found");
    if (row.isLifetime) throw new Error("Lifetime cannot be archived this way.");
    await ctx.db.patch(row._id, {
      archived: args.archived,
      marketingVisible: args.archived ? false : row.marketingVisible,
      homepageHighlight: args.archived ? false : row.homepageHighlight,
      selfServe: args.archived ? false : row.selfServe,
      updatedAt: Date.now(),
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: args.archived ? "plan.archive" : "plan.restore",
      entityType: "plans",
      entityId: row._id,
      metadata: { key: row.key },
    });
    return { ok: true as const };
  },
});

export const deletePlan = mutation({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const row = await ctx.db.get(args.planId);
    if (!row) throw new Error("Plan not found");
    if (isSeedPlanKey(row.key) || row.isLifetime) {
      throw new Error("Seed and lifetime plans cannot be deleted. Archive instead.");
    }
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    if (subs.some((s) => s.planKey === row.key)) {
      throw new Error("Cannot delete a plan with active subscriptions. Archive it instead.");
    }
    await ctx.db.delete(row._id);
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "plan.delete",
      entityType: "plans",
      entityId: args.planId,
      metadata: { key: row.key },
    });
    return { ok: true as const };
  },
});

async function enforceHomepageCap(
  ctx: { db: import("./_generated/server").MutationCtx["db"] },
  exceptId: import("./_generated/dataModel").Id<"plans"> | null,
) {
  const rows = await ctx.db.query("plans").collect();
  const highlighted = rows.filter(
    (row) => row.homepageHighlight && (!exceptId || row._id !== exceptId),
  );
  if (highlighted.length >= MAX_HOMEPAGE_HIGHLIGHTS) {
    throw new Error(
      `Homepage can highlight at most ${MAX_HOMEPAGE_HIGHLIGHTS} plans. Turn one off first.`,
    );
  }
}
