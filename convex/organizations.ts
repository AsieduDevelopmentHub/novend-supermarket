import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getProfileByUserId, requireProfile } from "./shared/permissions";

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await getProfileByUserId(ctx, userId);
    if (!profile) return { needsOnboarding: true as const };
    const organization = await ctx.db.get(profile.organizationId);
    return {
      needsOnboarding: false as const,
      organizationId: profile.organizationId,
      name: organization?.name ?? "",
      currency: organization?.currency ?? "GHS",
      role: profile.role,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    currency: v.optional(v.string()),
    timezone: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    taxId: v.optional(v.string()),
  },
  handler: async () => {
    throw new Error(
      "Public organization signup is disabled. A Novend platform administrator must create this business.",
    );
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const { organization } = await requireProfile(ctx);
    return organization;
  },
});
