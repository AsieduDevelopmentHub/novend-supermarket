import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  getPlatformAdmin,
  getProfileByUserId,
  requireAuth,
  requireProfile,
} from "./shared/permissions";
import { provisionOrganization } from "./shared/provisionOrganization";
import { DEFAULT_BRANCH_NAME } from "./shared/defaultBranch";
import { sanitizeText, TEXT_LIMITS } from "./shared/validation";

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

/**
 * Public SaaS onboarding. A signed-in user with no staff profile creates their
 * organization and becomes its owner on a 14-day Pro trial.
 */
export const create = mutation({
  args: {
    name: v.string(),
    currency: v.optional(v.string()),
    timezone: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    taxId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    const existing = await getProfileByUserId(ctx, userId);
    if (existing) {
      throw new Error("This account already belongs to a business.");
    }
    const platformAdmin = await getPlatformAdmin(ctx, userId);
    if (platformAdmin) {
      throw new Error("Platform administrators create businesses from the platform dashboard.");
    }

    const ownerName = sanitizeText(
      user.name?.trim() || user.email?.split("@")[0] || "Owner",
      "Name",
      TEXT_LIMITS.name,
    );

    const { organizationId, branchId } = await provisionOrganization(ctx, {
      name: args.name,
      currency: args.currency,
      phone: args.phone,
      address: args.address,
      taxId: args.taxId,
      email: user.email ?? undefined,
      ownerUserId: userId,
      actorId: userId,
      license: { kind: "trial", planKey: "pro" },
      auditAction: "organization_self_signup",
    });

    if (args.timezone?.trim()) {
      await ctx.db.patch(organizationId, { timezone: args.timezone.trim().slice(0, 64) });
    }

    await ctx.db.insert("profiles", {
      organizationId,
      userId,
      name: ownerName,
      role: "administrator",
      branch: DEFAULT_BRANCH_NAME,
      branchId,
      status: "active",
      lastSeenAt: 0,
    });

    return { organizationId, branchId };
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const { organization } = await requireProfile(ctx);
    return organization;
  },
});
