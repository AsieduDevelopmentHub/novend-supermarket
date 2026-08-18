import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./shared/permissions";
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
    const { organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    let rows = await ctx.db
      .query("suppliers")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    if (!args.includeInactive) {
      rows = rows.filter((row) => row.status === "active");
    }
    if (args.search?.trim()) {
      const q = args.search.trim().toLowerCase();
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          (row.contactName?.toLowerCase().includes(q) ?? false) ||
          (row.phone?.includes(q) ?? false),
      );
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { id: v.id("suppliers") },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const supplier = await ctx.db.get(args.id);
    if (!supplier || supplier.organizationId !== organizationId) return null;
    const purchases = await ctx.db
      .query("supplierPurchases")
      .withIndex("by_supplier", (q) => q.eq("supplierId", args.id))
      .collect();
    const completed = purchases.filter((p) => p.status === "completed");
    return {
      ...supplier,
      purchaseCount: completed.length,
      purchaseTotal: completed.reduce((sum, p) => sum + p.totalCost, 0),
      purchases: completed
        .sort((a, b) => b.purchasedAt - a.purchasedAt)
        .slice(0, 50)
        .map((p) => ({
          id: p._id,
          reference: p.reference,
          invoiceNumber: p.invoiceNumber ?? null,
          purchasedAt: p.purchasedAt,
          itemCount: p.itemCount,
          totalCost: p.totalCost,
        })),
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const name = sanitizeText(args.name, "Supplier name", TEXT_LIMITS.name);
    const id = await ctx.db.insert("suppliers", {
      organizationId,
      name,
      contactName: sanitizeOptionalText(args.contactName, "Contact", TEXT_LIMITS.name),
      phone: sanitizePhone(args.phone),
      email: sanitizeEmail(args.email),
      address: sanitizeOptionalText(args.address, "Address", TEXT_LIMITS.address),
      notes: sanitizeOptionalText(args.notes, "Notes", TEXT_LIMITS.note),
      status: "active",
      createdAt: Date.now(),
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "create_supplier",
      entityType: "suppliers",
      entityId: id,
      organizationId,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("suppliers"),
    name: v.string(),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new Error("Supplier not found");
    }
    await ctx.db.patch(args.id, {
      name: sanitizeText(args.name, "Supplier name", TEXT_LIMITS.name),
      contactName: sanitizeOptionalText(args.contactName, "Contact", TEXT_LIMITS.name),
      phone: sanitizePhone(args.phone),
      email: sanitizeEmail(args.email),
      address: sanitizeOptionalText(args.address, "Address", TEXT_LIMITS.address),
      notes: sanitizeOptionalText(args.notes, "Notes", TEXT_LIMITS.note),
      status: args.status,
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_supplier",
      entityType: "suppliers",
      entityId: args.id,
      organizationId,
    });
    return args.id;
  },
});
