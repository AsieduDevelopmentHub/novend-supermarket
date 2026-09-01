import { getAuthUserId, invalidateSessions, retrieveAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getProfileByUserId, requireSessionIgnoringLicense } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import {
  ACCOUNT_CLOSURE_GRACE_MS,
  archiveOrganizationRecord,
  hasPendingOrganizationClosure,
  isOrganizationOwner,
  normalizeRestorableStatus,
} from "./shared/accountClosure";
import { countUsage, getActiveSubscription } from "./shared/entitlements";
import type { OrganizationStatus } from "./shared/licensing";
import { assertOwnedStorage } from "./shared/storageSessions";
import { notifyPlatformAdminsOrganizationClosure } from "./shared/transactionalEmail";

/** Context for the Settings → Privacy & data retention screen. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const profile = await getProfileByUserId(ctx, userId);
    if (!profile) return null;

    const organization = await ctx.db.get(profile.organizationId);
    if (!organization) return null;

    const usage = await countUsage(ctx, organization._id);
    const now = Date.now();
    const memberSinceDays = Math.max(
      1,
      Math.floor((now - organization.createdAt) / (24 * 60 * 60 * 1000)),
    );

    return {
      organizationId: organization._id,
      organizationName: organization.name,
      isOwner: isOrganizationOwner(organization, userId),
      organizationStatus: organization.status,
      pendingClosure: hasPendingOrganizationClosure(organization, now),
      closureRequestedAt: organization.closureRequestedAt ?? null,
      closureEffectiveAt: organization.closureEffectiveAt ?? null,
      closureReason: organization.closureReason ?? null,
      stats: {
        activeProducts: usage.products,
        activeStaff: usage.users,
        activeBranches: usage.branches,
        memberSinceDays,
      },
    };
  },
});

export const cancelOrganizationClosure = mutation({
  args: {},
  handler: async (ctx) => {
    // Owner undo must work while the org is suspended for pending closure.
    const { userId, organization } = await requireSessionIgnoringLicense(ctx);
    if (!isOrganizationOwner(organization, userId)) {
      throw new Error("Only the business owner can restore this organization.");
    }
    if (!organization.closureEffectiveAt || organization.closureEffectiveAt <= Date.now()) {
      throw new Error("This organization is not in a cancellable closure window.");
    }

    const restoreStatus = normalizeRestorableStatus(
      organization.closurePreviousStatus as OrganizationStatus | undefined,
    );
    const now = Date.now();
    await ctx.db.patch(organization._id, {
      status: restoreStatus,
      updatedAt: now,
      closureRequestedAt: undefined,
      closureEffectiveAt: undefined,
      closureRequestedBy: undefined,
      closureReason: undefined,
      closurePreviousStatus: undefined,
    });

    await writeAuditLog(ctx, {
      organizationId: organization._id,
      actorId: userId,
      action: "cancel_organization_closure",
      entityType: "organizations",
      entityId: organization._id,
    });

    return { restored: true as const };
  },
});

export const requestOrganizationClosure = action({
  args: {
    currentPassword: v.string(),
    confirmName: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await ctx.runQuery(api.users.me, {});
    if (!me?.email || !me.userId || me.needsProfile) {
      throw new Error("You must be signed in to close this business.");
    }

    const context = await ctx.runQuery(internal.accountClosure.closureContext, {
      userId: me.userId,
    });
    if (!context) throw new Error("Forbidden");
    if (!context.isOwner) {
      throw new Error("Only the business owner can close this organization.");
    }
    if (context.pendingClosure) {
      throw new Error("A closure is already scheduled for this business.");
    }
    if (args.confirmName.trim() !== context.organizationName) {
      throw new Error("Type the exact business name to confirm.");
    }

    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: me.email, secret: args.currentPassword },
      });
    } catch {
      throw new Error("Password is incorrect.");
    }

    await ctx.runMutation(internal.accountClosure.beginOrganizationClosure, {
      organizationId: context.organizationId,
      actorId: me.userId,
      reason: args.reason?.trim().slice(0, 500) || undefined,
    });

    return { scheduled: true as const, effectiveAt: Date.now() + ACCOUNT_CLOSURE_GRACE_MS };
  },
});

export const deleteMyAccount = action({
  args: { currentPassword: v.string() },
  handler: async (ctx, args) => {
    const me = await ctx.runQuery(api.users.me, {});
    if (!me?.email || !me.userId || me.needsProfile) {
      throw new Error("You must be signed in to remove your account.");
    }

    const context = await ctx.runQuery(internal.accountClosure.closureContext, {
      userId: me.userId,
    });
    if (!context) throw new Error("Forbidden");
    if (context.isOwner) {
      throw new Error(
        "Organization owners must close the business from Privacy & data instead of removing only their staff account.",
      );
    }

    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: me.email, secret: args.currentPassword },
      });
    } catch {
      throw new Error("Password is incorrect.");
    }

    await ctx.runMutation(internal.accountClosure.finalizeStaffAccountDeletion, {
      profileId: context.profileId,
      actorId: me.userId,
    });

    await invalidateSessions(ctx, { userId: me.userId });

    return { removed: true as const };
  },
});

export const closureContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await getProfileByUserId(ctx, args.userId);
    if (!profile) return null;
    const organization = await ctx.db.get(profile.organizationId);
    if (!organization) return null;
    const now = Date.now();
    return {
      profileId: profile._id,
      organizationId: organization._id,
      organizationName: organization.name,
      isOwner: isOrganizationOwner(organization, args.userId),
      pendingClosure: hasPendingOrganizationClosure(organization, now),
    };
  },
});

export const beginOrganizationClosure = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) throw new Error("Organization not found");
    if (!isOrganizationOwner(organization, args.actorId)) {
      throw new Error("Only the business owner can close this organization.");
    }
    if (hasPendingOrganizationClosure(organization)) {
      throw new Error("A closure is already scheduled for this business.");
    }

    const now = Date.now();
    const previousStatus = organization.status as OrganizationStatus;
    await ctx.db.patch(args.organizationId, {
      status: "suspended",
      updatedAt: now,
      closureRequestedAt: now,
      closureEffectiveAt: now + ACCOUNT_CLOSURE_GRACE_MS,
      closureRequestedBy: args.actorId,
      closureReason: args.reason,
      closurePreviousStatus: previousStatus,
    });

    const subscription = await getActiveSubscription(ctx, organization);
    if (subscription && !subscription.isLifetime && !subscription.cancelAtPeriodEnd) {
      await ctx.db.patch(subscription._id, {
        cancelAtPeriodEnd: true,
        cancelledAt: now,
        nextBillingDate: undefined,
        updatedAt: now,
      });
      await writeAuditLog(ctx, {
        organizationId: args.organizationId,
        actorId: args.actorId,
        action: "billing_subscription_cancelled",
        entityType: "subscriptions",
        entityId: subscription._id,
        metadata: { reason: "organization_closure", effectiveAt: subscription.expiresAt ?? null },
      });
    }

    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: args.actorId,
      action: "request_organization_closure",
      entityType: "organizations",
      entityId: args.organizationId,
      metadata: {
        effectiveAt: now + ACCOUNT_CLOSURE_GRACE_MS,
        reason: args.reason ?? null,
      },
    });

    await ctx.scheduler.runAfter(0, internal.accountClosure.notifyPlatformAdminsClosure, {
      kind: "requested",
      organizationId: args.organizationId,
      organizationName: organization.name,
      effectiveAt: now + ACCOUNT_CLOSURE_GRACE_MS,
      reason: args.reason,
    });
  },
});

export const finalizeStaffAccountDeletion = internalMutation({
  args: {
    profileId: v.id("profiles"),
    actorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.userId !== args.actorId) {
      throw new Error("Forbidden");
    }

    const organization = await ctx.db.get(profile.organizationId);
    if (!organization) throw new Error("Organization not found");
    if (isOrganizationOwner(organization, args.actorId)) {
      throw new Error("Organization owners cannot remove only their staff account.");
    }

    const now = Date.now();
    if (profile.imageStorageId) {
      try {
        await assertOwnedStorage(ctx, profile.imageStorageId, profile.organizationId);
        await ctx.storage.delete(profile.imageStorageId);
      } catch {
        /* best-effort cleanup */
      }
    }

    await ctx.db.patch(profile._id, {
      name: "Removed user",
      phone: undefined,
      imageStorageId: undefined,
      status: "inactive",
      deactivatedAt: now,
      deactivatedBy: args.actorId,
      accountDeletionRequestedAt: now,
    });

    await writeAuditLog(ctx, {
      organizationId: profile.organizationId,
      actorId: args.actorId,
      action: "delete_own_account",
      entityType: "profiles",
      entityId: profile._id,
    });
  },
});

/** Daily cron — finalizes self-service closures once the grace window ends. */
export const finalizeDueClosures = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const organizations = await ctx.db.query("organizations").collect();
    let finalized = 0;

    for (const organization of organizations) {
      if (!organization.closureEffectiveAt || organization.closureEffectiveAt > now) continue;
      const organizationId = organization._id;
      const organizationName = organization.name;
      const reason = organization.closureReason;
      await archiveOrganizationRecord(ctx, {
        organizationId,
        actorId: organization.closureRequestedBy,
        auditAction: "finalize_organization_closure",
        metadata: {
          requestedAt: organization.closureRequestedAt ?? null,
          reason: reason ?? null,
        },
      });
      await ctx.scheduler.runAfter(0, internal.accountClosure.notifyPlatformAdminsClosure, {
        kind: "finalized",
        organizationId,
        organizationName,
        reason: reason ?? undefined,
      });
      finalized += 1;
    }

    return { finalized };
  },
});

export const platformAdminRecipientEmails = internalQuery({
  args: {},
  handler: async (ctx) => {
    const admins = await ctx.db.query("platformAdmins").collect();
    const emails = new Set<string>();
    for (const admin of admins) {
      const user = await ctx.db.get(admin.userId);
      if (user?.email) emails.add(user.email.trim().toLowerCase());
    }
    return [...emails];
  },
});

export const notifyPlatformAdminsClosure = internalAction({
  args: {
    kind: v.union(v.literal("requested"), v.literal("finalized")),
    organizationId: v.id("organizations"),
    organizationName: v.string(),
    effectiveAt: v.optional(v.number()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const recipientEmails = await ctx.runQuery(
      internal.accountClosure.platformAdminRecipientEmails,
      {},
    );
    await notifyPlatformAdminsOrganizationClosure({
      kind: args.kind,
      organizationName: args.organizationName,
      organizationId: args.organizationId,
      effectiveAt: args.effectiveAt,
      reason: args.reason ?? null,
      recipientEmails,
    });
  },
});
