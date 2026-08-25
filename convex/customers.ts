import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOrgDoc, requireRole } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import {
  sanitizeEmail,
  sanitizeOptionalText,
  sanitizePhone,
  sanitizeText,
  TEXT_LIMITS,
} from "./shared/validation";

export const list = query({
  args: {
    search: v.optional(v.string()),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    let customers = await ctx.db
      .query("customers")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    if (!args.includeInactive) {
      customers = customers.filter((c) => c.status === "active");
    }

    if (args.search?.trim()) {
      const q = args.search.trim().toLowerCase();
      customers = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q),
      );
    }

    const sales = await ctx.db
      .query("sales")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    return customers
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((customer) => {
        const customerSales = sales
          .filter((s) => s.customerId === customer._id)
          .sort((a, b) => b.completedAt - a.completedAt);
        const last = customerSales[0];
        return {
          id: customer._id,
          name: customer.name,
          phone: customer.phone ?? null,
          email: customer.email ?? null,
          notes: customer.notes ?? null,
          status: customer.status,
          purchaseCount: customerSales.length,
          lastPurchaseAt: last?.completedAt ?? null,
          lastPurchaseTotal: last?.total ?? null,
          lastInvoiceNumber: last?.invoiceNumber ?? null,
        };
      });
  },
});

export const search = query({
  args: {
    q: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    const queryText = args.q.trim().toLowerCase();
    if (!queryText) return [];
    const limit = Math.min(args.limit ?? 8, 20);
    const customers = await ctx.db
      .query("customers")
      .withIndex("by_organization_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "active"),
      )
      .collect();
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(queryText) ||
          c.phone?.toLowerCase().includes(queryText) ||
          c.email?.toLowerCase().includes(queryText),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((c) => ({
        id: c._id,
        name: c.name,
        phone: c.phone ?? null,
      }));
  },
});

export const get = query({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    const customer = await ctx.db.get(args.id);
    if (!customer || customer.organizationId !== organizationId) return null;
    return {
      id: customer._id,
      name: customer.name,
      phone: customer.phone ?? null,
      email: customer.email ?? null,
      notes: customer.notes ?? null,
      status: customer.status,
    };
  },
});

export const purchaseHistory = query({
  args: {
    customerId: v.id("customers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.organizationId !== organizationId) return [];
    const limit = Math.min(args.limit ?? 20, 50);
    const sales = await ctx.db
      .query("sales")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();

    return sales
      .filter((sale) => sale.organizationId === organizationId)
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, limit)
      .map((sale) => ({
        id: sale._id,
        invoiceNumber: sale.invoiceNumber,
        total: sale.total,
        itemCount: sale.itemCount,
        paymentMethod: sale.paymentMethod,
        completedAt: sale.completedAt,
      }));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const name = sanitizeText(args.name, "Customer name", TEXT_LIMITS.name);

    const id = await ctx.db.insert("customers", {
      organizationId,
      name,
      phone: sanitizePhone(args.phone),
      email: sanitizeEmail(args.email),
      notes: sanitizeOptionalText(args.notes, "Notes", TEXT_LIMITS.note),
      status: "active",
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "create_customer",
      entityType: "customers",
      entityId: id,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("customers"),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    if (profile.role !== "administrator" && args.status === "inactive") {
      throw new Error("Only administrators can deactivate customers");
    }
    const customer = await ctx.db.get(args.id);
    assertOrgDoc(customer, organizationId);

    const name = sanitizeText(args.name, "Customer name", TEXT_LIMITS.name);

    await ctx.db.patch(args.id, {
      name,
      phone: sanitizePhone(args.phone),
      email: sanitizeEmail(args.email),
      notes: sanitizeOptionalText(args.notes, "Notes", TEXT_LIMITS.note),
      status: args.status,
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_customer",
      entityType: "customers",
      entityId: args.id,
    });
  },
});

export const archive = mutation({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator"]);
    const customer = await ctx.db.get(args.id);
    assertOrgDoc(customer, organizationId);
    await ctx.db.patch(args.id, { status: "inactive" });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "archive_customer",
      entityType: "customers",
      entityId: args.id,
    });
  },
});
