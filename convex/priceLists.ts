import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { assertOrgDoc, requireRole } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import { rememberClientOp, replayClientOp } from "./shared/clientOps";
import { hasBusinessCapability } from "./shared/businessCapabilities";
import { assertValidPriceRule } from "./shared/pricing";
import { roundMoney, sanitizeText, TEXT_LIMITS } from "./shared/validation";
import { loadBusinessConfiguration } from "./settings";

async function assertPricingEnabled(ctx: QueryCtx | MutationCtx, organizationId: Id<"organizations">) {
  const config = await loadBusinessConfiguration(ctx, organizationId);
  if (!hasBusinessCapability(config, "customer_pricing")) {
    throw new Error("Customer price lists are not enabled for this organization");
  }
}

export const listGroups = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const groups = await ctx.db
      .query("customerGroups")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    return groups
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((group) => ({ id: group._id, name: group.name, status: group.status }));
  },
});

export const listRules = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const rules = await ctx.db
      .query("priceListRules")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    return rules
      .sort((a, b) => b.priority - a.priority)
      .map((rule) => ({
        id: rule._id,
        productId: rule.productId ?? null,
        categoryId: rule.categoryId ?? null,
        groupId: rule.groupId ?? null,
        minBaseQty: rule.minBaseQty,
        unitPrice: rule.unitPrice,
        priority: rule.priority,
        active: rule.active,
      }));
  },
});

export const saveGroup = mutation({
  args: {
    id: v.optional(v.id("customerGroups")),
    name: v.string(),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    clientOperationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const replayed = await replayClientOp<Id<"customerGroups">>(
      ctx,
      organizationId,
      args.clientOperationId,
    );
    if (replayed) return replayed;
    await assertPricingEnabled(ctx, organizationId);
    const name = sanitizeText(args.name, "Group name", TEXT_LIMITS.name);

    const siblings = await ctx.db
      .query("customerGroups")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    if (siblings.some((g) => g._id !== args.id && g.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("A customer group with this name already exists");
    }

    let id: Id<"customerGroups">;
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      assertOrgDoc(existing, organizationId);
      await ctx.db.patch(args.id, { name, status: args.status ?? existing.status });
      id = args.id;
    } else {
      id = await ctx.db.insert("customerGroups", {
        organizationId,
        name,
        status: args.status ?? "active",
      });
    }
    await writeAuditLog(ctx, {
      actorId: userId,
      action: args.id ? "update_customer_group" : "create_customer_group",
      entityType: "customerGroups",
      entityId: id,
      organizationId,
    });
    await rememberClientOp(ctx, {
      organizationId,
      clientOperationId: args.clientOperationId,
      kind: "save_customer_group",
      result: id,
    });
    return id;
  },
});

export const saveRule = mutation({
  args: {
    id: v.optional(v.id("priceListRules")),
    productId: v.optional(v.id("products")),
    categoryId: v.optional(v.id("categories")),
    groupId: v.optional(v.id("customerGroups")),
    minBaseQty: v.number(),
    /** Price per base unit. */
    unitPrice: v.number(),
    priority: v.number(),
    active: v.boolean(),
    clientOperationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const replayed = await replayClientOp<Id<"priceListRules">>(
      ctx,
      organizationId,
      args.clientOperationId,
    );
    if (replayed) return replayed;
    await assertPricingEnabled(ctx, organizationId);
    assertValidPriceRule(args);

    if (args.productId) {
      const product = await ctx.db.get(args.productId);
      assertOrgDoc(product, organizationId);
    }
    if (args.categoryId) {
      const category = await ctx.db.get(args.categoryId);
      assertOrgDoc(category, organizationId);
    }
    if (args.groupId) {
      const group = await ctx.db.get(args.groupId);
      assertOrgDoc(group, organizationId);
    }

    const fields = {
      productId: args.productId,
      categoryId: args.productId ? undefined : args.categoryId,
      groupId: args.groupId,
      minBaseQty: Math.floor(args.minBaseQty),
      unitPrice: roundMoney(args.unitPrice),
      priority: args.priority,
      active: args.active,
    };
    let id: Id<"priceListRules">;
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      assertOrgDoc(existing, organizationId);
      await ctx.db.replace(args.id, { organizationId, ...fields });
      id = args.id;
    } else {
      id = await ctx.db.insert("priceListRules", { organizationId, ...fields });
    }
    await writeAuditLog(ctx, {
      actorId: userId,
      action: args.id ? "update_price_rule" : "create_price_rule",
      entityType: "priceListRules",
      entityId: id,
      organizationId,
    });
    await rememberClientOp(ctx, {
      organizationId,
      clientOperationId: args.clientOperationId,
      kind: "save_price_rule",
      result: id,
    });
    return id;
  },
});
