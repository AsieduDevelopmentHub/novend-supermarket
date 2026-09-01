import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import { sanitizeText, TEXT_LIMITS } from "./shared/validation";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    const rows = await ctx.db
      .query("categories")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    return rows.filter((c) => c.isActive);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const name = sanitizeText(args.name, "Category name", TEXT_LIMITS.name);
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_organization_slug", (q) =>
        q.eq("organizationId", organizationId).eq("slug", slug),
      )
      .unique();
    if (existing) {
      if (!existing.isActive || existing.name !== name) {
        await ctx.db.patch(existing._id, { isActive: true, name });
      }
      return existing._id;
    }
    const id = await ctx.db.insert("categories", {
      organizationId,
      name,
      slug,
      isActive: true,
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "create_category",
      entityType: "categories",
      entityId: id,
    });
    return id;
  },
});
