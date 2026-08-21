import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import {
  canManageBranches,
  requireProfile,
  requireRole,
} from "./shared/permissions";
import { assertOrganizationCapacity } from "./shared/entitlements";
import {
  sanitizeOptionalText,
  sanitizePhone,
  sanitizeText,
  TEXT_LIMITS,
} from "./shared/validation";
import { writeAuditLog } from "./shared/audit";
import { ensureBranchStockRow, stockMapForBranch } from "./shared/branchStock";
import { completedReturnsInRange, loadItemsForReturns, cogsForLines } from "./shared/returns";

function toBranchDto(doc: Doc<"branches">) {
  return {
    ...doc,
    id: doc._id,
  };
}

function normalizeCode(code: string) {
  return sanitizeText(code, "Branch code", TEXT_LIMITS.code).toUpperCase().replace(/\s+/g, "_");
}

export const list = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { organizationId, profile } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    let rows = await ctx.db
      .query("branches")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    if (!args.includeInactive) {
      rows = rows.filter((row) => row.status === "active");
    }
    if (profile.role !== "administrator") {
      rows = rows.filter((row) => row._id === profile.branchId);
    }
    return rows.map(toBranchDto);
  },
});

export const listTransferOptions = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId, profile } = await requireRole(ctx, ["administrator", "manager"]);
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    return branches
      .filter((b) => b.status === "active" && b._id !== profile.branchId)
      .map(toBranchDto);
  },
});

export const getMineForReceipt = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx);
    if (!profile.branchId) return null;
    const branch = await ctx.db.get(profile.branchId);
    return branch ? toBranchDto(branch) : null;
  },
});

export const updateReceiptProfile = mutation({
  args: {
    id: v.optional(v.id("branches")),
    name: v.optional(v.string()),
    receiptShowName: v.optional(v.boolean()),
    receiptShowAddress: v.optional(v.boolean()),
    receiptShowPhone: v.optional(v.boolean()),
    receiptShowEmail: v.optional(v.boolean()),
    receiptPaperWidthMm: v.optional(v.union(v.literal(58), v.literal(80))),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const branchId = args.id ?? profile.branchId;
    if (!branchId) throw new Error("No branch assigned");
    const branch = await ctx.db.get(branchId);
    if (!branch || branch.organizationId !== organizationId) throw new Error("Not found");
    if (profile.role === "manager" && branchId !== profile.branchId) {
      throw new Error("Forbidden");
    }
    await ctx.db.patch(branch._id, {
      ...(args.name ? { name: args.name } : {}),
      receiptShowName: args.receiptShowName,
      receiptShowAddress: args.receiptShowAddress,
      receiptShowPhone: args.receiptShowPhone,
      receiptShowEmail: args.receiptShowEmail,
      receiptPaperWidthMm: args.receiptPaperWidthMm,
      address: sanitizeOptionalText(args.address, "Address", TEXT_LIMITS.address),
      phone: args.phone,
      email: args.email,
    });
  },
});

export const get = query({
  args: { id: v.id("branches") },
  handler: async (ctx, args) => {
    const { organizationId } = await requireProfile(ctx);
    const branch = await ctx.db.get(args.id);
    if (!branch || branch.organizationId !== organizationId) return null;
    return toBranchDto(branch);
  },
});

export const getOverview = query({
  args: { id: v.id("branches") },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, ["administrator"]);
    if (!canManageBranches(profile)) throw new Error("Forbidden");
    const branch = await ctx.db.get(args.id);
    if (!branch || branch.organizationId !== organizationId) return null;

    const staffProfiles = (
      await ctx.db
        .query("profiles")
        .withIndex("by_branchId", (q) => q.eq("branchId", args.id))
        .collect()
    ).filter((p) => p.status === "active" && p.organizationId === organizationId);
    const manager = staffProfiles.find((p) => p.role === "manager") ?? null;
    const staff = staffProfiles.map((p) => ({
      id: p._id,
      name: p.name,
      role: p.role,
    }));

    const products = await ctx.db
      .query("products")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const stock = await stockMapForBranch(ctx, args.id);
    let inventoryValue = 0;
    for (const product of products) {
      if (product.status === "archived") continue;
      inventoryValue += (stock.get(product._id) ?? 0) * product.costPrice;
    }

    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const sales = (
      await ctx.db
        .query("sales")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect()
    ).filter((s) => s.branchId === args.id && s.completedAt >= since);
    const returns = await completedReturnsInRange(ctx, {
      startDate: since,
      endDate: Date.now(),
      organizationId,
      branchId: args.id,
    });
    const expenses = (
      await ctx.db
        .query("expenses")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect()
    ).filter((e) => e.branchId === args.id && e.occurredAt >= since);
    const saleIds = new Set(sales.map((s) => s._id));
    const items = (
      await ctx.db
        .query("saleItems")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect()
    ).filter((i) => saleIds.has(i.saleId));
    const returnItems = await loadItemsForReturns(
      ctx,
      returns.map((row) => row._id),
    );
    const costByProduct = new Map(products.map((p) => [p._id, p.costPrice]));
    const soldCogs = cogsForLines(items, costByProduct);
    const returnedCogs = cogsForLines(returnItems, costByProduct);
    const cogs = soldCogs - returnedCogs;
    const revenueGross = sales.reduce((sum, s) => sum + s.total, 0);
    const refunds = returns.reduce((sum, row) => sum + row.refundAmount, 0);
    const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
    const revenue = revenueGross - refunds;
    const profit = revenue - cogs - expenseTotal;

    const recentSales = [...sales]
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, 20)
      .map((s) => ({
        id: s._id,
        invoiceNumber: s.invoiceNumber,
        customerName: s.customerName,
        total: s.total,
        itemCount: s.itemCount,
        completedAt: s.completedAt,
      }));

    return {
      ...toBranchDto(branch),
      manager: manager ? { id: manager._id, name: manager.name } : null,
      staff,
      kpis: {
        inventoryValue,
        revenue,
        profit,
        expenses: expenseTotal,
        refunds,
        orderCount: sales.length,
      },
      recentSales,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId, organization } = await requireRole(ctx, [
      "administrator",
    ]);
    if (!canManageBranches(profile)) throw new Error("Forbidden");
    await assertOrganizationCapacity(ctx, organization, "branches");

    const name = sanitizeText(args.name, "Branch name", TEXT_LIMITS.name);
    const code = normalizeCode(args.code);

    const existing = await ctx.db
      .query("branches")
      .withIndex("by_organization_code", (q) =>
        q.eq("organizationId", organizationId).eq("code", code),
      )
      .unique();
    if (existing) throw new Error("Branch code already exists");

    const id = await ctx.db.insert("branches", {
      organizationId,
      name,
      code,
      address: sanitizeOptionalText(args.address, "Address", TEXT_LIMITS.address),
      phone: sanitizePhone(args.phone),
      status: "active",
      createdAt: Date.now(),
    });

    const products = await ctx.db
      .query("products")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    for (const product of products.filter((p) => p.status !== "archived")) {
      await ensureBranchStockRow(ctx, id, product._id, 0);
    }

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "create_branch",
      entityType: "branches",
      entityId: id,
      organizationId,
      metadata: { name, code },
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("branches"),
    name: v.string(),
    code: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, ["administrator"]);
    if (!canManageBranches(profile)) throw new Error("Forbidden");

    const branch = await ctx.db.get(args.id);
    if (!branch || branch.organizationId !== organizationId) throw new Error("Branch not found");

    const name = sanitizeText(args.name, "Branch name", TEXT_LIMITS.name);
    const code = normalizeCode(args.code);

    const clash = await ctx.db
      .query("branches")
      .withIndex("by_organization_code", (q) =>
        q.eq("organizationId", organizationId).eq("code", code),
      )
      .unique();
    if (clash && clash._id !== args.id) throw new Error("Branch code already exists");

    await ctx.db.patch(args.id, {
      name,
      code,
      address: sanitizeOptionalText(args.address, "Address", TEXT_LIMITS.address),
      phone: sanitizePhone(args.phone),
      status: args.status,
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_branch",
      entityType: "branches",
      entityId: args.id,
      organizationId,
      metadata: { name, code, status: args.status },
    });

    return args.id;
  },
});
