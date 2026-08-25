import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { roleValidator } from "./schema";
import { ensureDefaultBranch, DEFAULT_BRANCH_NAME } from "./shared/defaultBranch";
import { bootstrapMultiBranch } from "./shared/multiBranchBootstrap";

/**
 * Ensures MAIN exists and legacy rows are branch-backfilled for the signed-in user.
 * Does **not** create profiles — staff accounts are provisioned only via
 * `users.createUserAccount` or the secure bootstrap CLI.
 */
export const ensureProfile = mutation({
  args: {
    name: v.optional(v.string()),
    role: v.optional(roleValidator),
    branch: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
    phone: v.optional(v.string()),
  },
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Unauthenticated");

    // Always bootstrap MAIN + stock/profile backfill (idempotent).
    await bootstrapMultiBranch(ctx);

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      if (!existing.branchId) {
        if (!existing.organizationId) {
          return existing._id;
        }
        const branchId = await ensureDefaultBranch(ctx, existing.organizationId);
        const branch = await ctx.db.get(branchId);
        await ctx.db.patch(existing._id, {
          branchId,
          branch: branch?.name ?? existing.branch ?? DEFAULT_BRANCH_NAME,
        });
      }
      return existing._id;
    }

    throw new Error("No staff profile for this account. Ask an administrator to create your user.");
  },
});
