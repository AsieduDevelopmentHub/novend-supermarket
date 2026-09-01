import {
  createAccount,
  getAuthSessionId,
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  getPlatformAdmin,
  getProfileByUserId,
  requireProfile,
  requireRole,
  requireSessionIgnoringLicense,
  assertOrgDoc,
  assertStaffProfileAccess,
} from "./shared/permissions";
import { roleValidator, telemetryRuntimeValidator } from "./schema";
import { writeAuditLog } from "./shared/audit";
import { Id } from "./_generated/dataModel";
import { assertStoredImage, sanitizePhone, sanitizeText, TEXT_LIMITS } from "./shared/validation";
import { assertPasswordPolicy } from "./shared/passwordPolicy";
import { notifyPasswordChanged } from "./shared/transactionalEmail";
import { assertOwnedStorage, beginStorageUploadSession } from "./shared/storageSessions";
import { assertOrganizationCapacity, countUsage, resolveLicense } from "./shared/entitlements";
import { limitReachedMessage } from "./shared/plans";
import { presenceFromLastSeenAt } from "./shared/presence";
import { deactivateAccountBlockReason } from "./shared/accountStatus";
import { loadEmailVerification } from "./shared/emailVerificationLookup";
import { recordDailyActiveUser } from "./shared/platformTelemetry";
import { loadTourProgressForUser } from "./shared/tourProgress";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const profile = await getProfileByUserId(ctx, userId);
    const platformAdmin = await getPlatformAdmin(ctx, userId);
    const verification = await loadEmailVerification(ctx, userId);
    if (!profile) {
      const tourProgress = await loadTourProgressForUser(ctx, userId, null);
      return {
        userId,
        email: user.email ?? null,
        emailVerified: verification.emailVerified,
        needsProfile: !platformAdmin,
        needsOnboarding: !platformAdmin,
        isPlatformAdmin: Boolean(platformAdmin),
        name: user.name ?? user.email?.split("@")[0] ?? "User",
        role: null,
        branch: null,
        branchId: null,
        phone: null,
        status: null,
        appearanceTheme: null,
        appearanceFontSize: null,
        imageUrl: null,
        organizationName: null,
        tourProgress,
      };
    }

    const branchDoc = profile.branchId ? await ctx.db.get(profile.branchId) : null;
    const organization = await ctx.db.get(profile.organizationId);
    const businessRow = await ctx.db
      .query("settings")
      .withIndex("by_organization_key", (q) =>
        q.eq("organizationId", profile.organizationId).eq("key", "business.profile"),
      )
      .unique();
    let organizationName = organization?.name ?? null;
    if (businessRow?.value) {
      try {
        const parsed = JSON.parse(businessRow.value) as { tradeName?: string };
        if (parsed.tradeName?.trim()) organizationName = parsed.tradeName.trim();
      } catch {
        /* keep organization name */
      }
    }
    const imageUrl = profile.imageStorageId
      ? await ctx.storage.getUrl(profile.imageStorageId)
      : null;
    const tourProgress = await loadTourProgressForUser(ctx, userId, profile);

    return {
      userId,
      email: user.email ?? null,
      emailVerified: verification.emailVerified,
      needsProfile: false as const,
      needsOnboarding: false as const,
      organizationId: profile.organizationId,
      organizationName,
      isPlatformAdmin: Boolean(platformAdmin),
      name: profile.name,
      role: profile.role,
      branch: branchDoc?.name ?? profile.branch ?? null,
      branchId: profile.branchId ?? null,
      phone: profile.phone ?? null,
      status: profile.status,
      appearanceTheme: profile.appearanceTheme ?? null,
      appearanceFontSize: profile.appearanceFontSize ?? null,
      imageUrl,
      tourProgress,
    };
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const { profile, userId, user } = await requireProfile(ctx);
    const branchDoc = profile.branchId ? await ctx.db.get(profile.branchId) : null;
    return {
      userId,
      email: user.email ?? null,
      name: profile.name,
      role: profile.role,
      branch: branchDoc?.name ?? profile.branch ?? null,
      branchId: profile.branchId ?? null,
      status: profile.status,
    };
  },
});

/** Internal: bootstrap refuses once any staff profile exists. */
export const hasAnyStaffProfile = internalQuery({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("profiles").take(1);
    return { hasUsers: existing.length > 0 };
  },
});

export const list = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const {
      profile: actor,
      organizationId,
      userId: actorUserId,
    } = await requireRole(ctx, ["administrator", "manager"]);
    const organization = await ctx.db.get(organizationId);
    const now = Date.now();
    let profiles = await ctx.db
      .query("profiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    if (actor.role === "manager") {
      profiles = profiles.filter(
        (p) => p.branchId === actor.branchId && (p.role === "cashier" || p._id === actor._id),
      );
    }
    const users = await Promise.all(profiles.map((p) => ctx.db.get(p.userId)));
    const emailById = new Map(users.flatMap((u) => (u ? [[u._id, u.email ?? null] as const] : [])));
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const branchName = new Map(branches.map((b) => [b._id, b.name]));

    let rows = await Promise.all(
      profiles.map(async (profile) => {
        const { lastSeenAt, presence } = presenceFromLastSeenAt(profile.lastSeenAt, now);
        const imageUrl = profile.imageStorageId
          ? await ctx.storage.getUrl(profile.imageStorageId)
          : null;
        return {
          id: profile._id,
          userId: profile.userId,
          name: profile.name,
          role: profile.role,
          branch: profile.branchId
            ? (branchName.get(profile.branchId) ?? profile.branch ?? "")
            : (profile.branch ?? ""),
          branchId: profile.branchId ?? null,
          phone: profile.phone ?? null,
          status: profile.status,
          email: emailById.get(profile.userId) ?? null,
          imageUrl,
          lastSeenAt,
          lastLoginAt: profile.lastLoginAt ?? null,
          lastDevice: profile.lastDevice ?? null,
          presence,
          isOwner: organization?.ownerUserId === profile.userId,
          isSelf: profile.userId === actorUserId,
        };
      }),
    );

    if (args.search?.trim()) {
      const q = args.search.trim().toLowerCase();
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          row.email?.toLowerCase().includes(q) ||
          row.phone?.includes(q),
      );
    }

    return rows.sort((a, b) => {
      if (a.presence !== b.presence) {
        return a.presence === "online" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  },
});

export const get = query({
  args: { id: v.id("profiles") },
  handler: async (ctx, args) => {
    const {
      profile: actor,
      organizationId,
      userId: actorUserId,
    } = await requireRole(ctx, ["administrator", "manager"]);
    const profile = await ctx.db.get(args.id);
    if (!profile || profile.organizationId !== organizationId) return null;
    assertStaffProfileAccess(actor, profile);
    const user = await ctx.db.get(profile.userId);
    const branchDoc = profile.branchId ? await ctx.db.get(profile.branchId) : null;
    const organization = await ctx.db.get(organizationId);
    const now = Date.now();
    const { lastSeenAt, presence } = presenceFromLastSeenAt(profile.lastSeenAt, now);
    const imageUrl = profile.imageStorageId
      ? await ctx.storage.getUrl(profile.imageStorageId)
      : null;
    return {
      id: profile._id,
      userId: profile.userId,
      name: profile.name,
      role: profile.role,
      branch: branchDoc?.name ?? profile.branch ?? "",
      branchId: profile.branchId ?? null,
      phone: profile.phone ?? null,
      status: profile.status,
      email: user?.email ?? null,
      imageUrl,
      lastSeenAt,
      lastLoginAt: profile.lastLoginAt ?? null,
      lastDevice: profile.lastDevice ?? null,
      presence,
      isOwner: organization?.ownerUserId === profile.userId,
      isSelf: profile.userId === actorUserId,
    };
  },
});

export const updateProfile = mutation({
  args: {
    id: v.id("profiles"),
    name: v.string(),
    role: roleValidator,
    branch: v.optional(v.string()),
    branchId: v.id("branches"),
    phone: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (ctx, args) => {
    const {
      userId,
      profile: actor,
      organizationId,
    } = await requireRole(ctx, ["administrator", "manager"]);
    const profile = await ctx.db.get(args.id);
    assertOrgDoc(profile, organizationId);

    if (actor.role === "manager") {
      if (profile.branchId !== actor.branchId) throw new Error("Forbidden");
      if (args.role !== "cashier") throw new Error("Managers can only manage cashiers");
      if (args.branchId !== actor.branchId) throw new Error("Cannot move users to another branch");
    }

    const branch = await ctx.db.get(args.branchId);
    if (!branch || branch.status !== "active" || branch.organizationId !== organizationId) {
      throw new Error("Invalid branch");
    }

    if (args.status === "inactive") {
      const organization = await ctx.db.get(organizationId);
      const { presence } = presenceFromLastSeenAt(profile.lastSeenAt);
      const blocked = deactivateAccountBlockReason({
        actorUserId: userId,
        targetUserId: profile.userId,
        ownerUserId: organization?.ownerUserId,
        presence,
      });
      if (blocked) throw new Error(blocked);
    }

    const previousStatus = profile.status;
    const now = Date.now();
    await ctx.db.patch(args.id, {
      name: sanitizeText(args.name, "Name", TEXT_LIMITS.name),
      role: args.role,
      branch: branch.name,
      branchId: args.branchId,
      phone: sanitizePhone(args.phone),
      status: args.status,
      ...(args.status === "inactive" && previousStatus === "active"
        ? { deactivatedAt: now, deactivatedBy: userId }
        : {}),
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action:
        previousStatus !== args.status
          ? args.status === "inactive"
            ? "deactivate_user"
            : "reactivate_user"
          : "update_user_profile",
      entityType: "profiles",
      entityId: args.id,
      metadata: {
        branchId: args.branchId,
        role: args.role,
        previousStatus,
        newStatus: args.status,
      },
    });
  },
});

/** Any authenticated staff member can update their own profile details / photo. */
export const generateProfileUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    const sessionId = await beginStorageUploadSession(ctx, {
      organizationId,
      userId,
      purpose: "profileImage",
    });
    return { uploadUrl: await ctx.storage.generateUploadUrl(), sessionId };
  },
});

export const updateOwnProfile = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    clearImage: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    const name = sanitizeText(args.name, "Name", TEXT_LIMITS.name);

    let imageStorageId = profile.imageStorageId;
    if (args.clearImage) {
      if (profile.imageStorageId) {
        try {
          await ctx.storage.delete(profile.imageStorageId);
        } catch {
          /* best-effort cleanup */
        }
      }
      imageStorageId = undefined;
    } else if (args.imageStorageId) {
      await assertStoredImage(ctx, args.imageStorageId);
      await assertOwnedStorage(ctx, args.imageStorageId, profile.organizationId);
      if (profile.imageStorageId && profile.imageStorageId !== args.imageStorageId) {
        try {
          await ctx.storage.delete(profile.imageStorageId);
        } catch {
          /* best-effort cleanup */
        }
      }
      imageStorageId = args.imageStorageId;
    }

    await ctx.db.patch(profile._id, {
      name,
      phone: sanitizePhone(args.phone),
      imageStorageId,
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_own_profile",
      entityType: "profiles",
      entityId: profile._id,
    });
  },
});

/** @deprecated Prefer updateOwnProfile. Kept for older clients. */
export const updateOwnContact = mutation({
  args: {
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    const phone = args.phone?.trim() || undefined;
    await ctx.db.patch(profile._id, { phone });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_own_contact",
      entityType: "profiles",
      entityId: profile._id,
    });
  },
});

/** Persist appearance preferences on the user profile (survives logout / new devices). */
export const updateOwnAppearance = mutation({
  args: {
    theme: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
    fontSize: v.union(v.literal("sm"), v.literal("md"), v.literal("lg")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const profile = await getProfileByUserId(ctx, userId);
    if (!profile) {
      // Platform-only Super Admins have no tenant profile — device theme still works via localStorage.
      const platformAdmin = await getPlatformAdmin(ctx, userId);
      if (platformAdmin) return null;
      throw new Error("Forbidden");
    }

    await ctx.db.patch(profile._id, {
      appearanceTheme: args.theme,
      appearanceFontSize: args.fontSize,
    });
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_own_appearance",
      entityType: "profiles",
      entityId: profile._id,
      metadata: { theme: args.theme, fontSize: args.fontSize },
    });
  },
});

/** Change password after verifying the current password. */
export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await ctx.runQuery(api.users.me, {});
    if (!me?.email || !me.userId) {
      throw new Error("You must be signed in to change your password");
    }
    assertPasswordPolicy(args.newPassword);
    if (args.currentPassword === args.newPassword) {
      throw new Error("New password must be different from the current password");
    }

    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: me.email, secret: args.currentPassword },
      });
    } catch {
      throw new Error("Current password is incorrect");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: me.email, secret: args.newPassword },
    });

    const sessionId = await getAuthSessionId(ctx);
    await invalidateSessions(ctx, {
      userId: me.userId,
      except: sessionId ? [sessionId] : undefined,
    });

    await ctx.runMutation(internal.users.writePasswordChangeAudit, {
      userId: me.userId,
    });

    await notifyPasswordChanged(me.email);

    return { ok: true as const };
  },
});

export const writePasswordChangeAudit = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await getProfileByUserId(ctx, args.userId);
    await writeAuditLog(ctx, {
      actorId: args.userId,
      action: "change_password",
      entityType: "profiles",
      entityId: profile?._id,
    });
  },
});

export const heartbeat = mutation({
  args: {
    device: v.optional(v.string()),
    runtime: v.optional(telemetryRuntimeValidator),
    appVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile, userId, organizationId } = await requireSessionIgnoringLicense(ctx);
    const now = Date.now();
    const sessionFresh = !profile.lastLoginAt || now - profile.lastLoginAt > 8 * 60 * 60 * 1000;
    await ctx.db.patch(profile._id, {
      lastSeenAt: now,
      ...(args.device ? { lastDevice: args.device.slice(0, 120) } : {}),
      ...(sessionFresh ? { lastLoginAt: now } : {}),
    });
    if (args.runtime) {
      await recordDailyActiveUser(ctx, {
        userId,
        organizationId,
        runtime: args.runtime,
        appVersion: args.appVersion,
        occurredAt: now,
      });
    }
  },
});

export const clearPresence = mutation({
  args: {},
  handler: async (ctx) => {
    await requireSessionIgnoringLicense(ctx);
    // Presence is derived from lastSeenAt and the client heartbeat window.
    // Sign-out stops heartbeats; do not zero lastSeenAt or last login timestamps.
  },
});

/** Whether the plan still allows another staff account. */
export const staffCapacity = query({
  args: {},
  handler: async (ctx) => {
    const { organization, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const license = await resolveLicense(ctx, organization);
    const limit = license.limits.users;
    const usage = await countUsage(ctx, organizationId);
    const used = usage.users;
    if (limit === null) {
      return { allowed: true as const, used, limit: null, message: "" };
    }
    const allowed = used < limit;
    return {
      allowed,
      used,
      limit,
      message: allowed ? "" : limitReachedMessage(license.planKey, "users", limit),
    };
  },
});

export const insertProfileForUser = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    role: roleValidator,
    branch: v.optional(v.string()),
    branchId: v.id("branches"),
    phone: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const existing = await getProfileByUserId(ctx, args.userId);
    if (existing) return existing._id;

    const branch = await ctx.db.get(args.branchId);
    if (!branch) throw new Error("Invalid branch");
    if (branch.organizationId !== args.organizationId) {
      throw new Error("Invalid branch");
    }

    const organization = await ctx.db.get(args.organizationId);
    if (!organization) throw new Error("Invalid branch");
    await assertOrganizationCapacity(ctx, organization, "users");

    const profileId = await ctx.db.insert("profiles", {
      organizationId: branch.organizationId,
      userId: args.userId,
      name: args.name.trim(),
      role: args.role,
      branch: branch.name,
      branchId: args.branchId,
      phone: args.phone?.trim(),
      status: "active",
      lastSeenAt: 0,
    });

    await writeAuditLog(ctx, {
      actorId: args.actorId ?? args.userId,
      action: "create_user_account",
      entityType: "profiles",
      entityId: profileId,
      metadata: { role: args.role, branchId: args.branchId },
    });

    return profileId;
  },
});

/**
 * Create a password account + profile.
 * Only administrators (any role/branch) or managers (cashiers in own branch).
 * Initial administrator must be provisioned via `bootstrapAdministrator`.
 */
export const createUserAccount = action({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    role: roleValidator,
    branch: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const name = args.name.trim();
    const password = args.password;

    if (!email || !name) throw new Error("Name and email are required");
    assertPasswordPolicy(password);

    const me = await ctx.runQuery(api.users.me, {});
    if (!me || (me.role !== "administrator" && me.role !== "manager")) {
      throw new Error("Only administrators or managers can create user accounts");
    }

    // Checked before the auth account exists so a full plan cannot leave an
    // orphaned credential behind. `insertProfileForUser` re-checks on write.
    const capacity = await ctx.runQuery(api.users.staffCapacity, {});
    if (!capacity.allowed) throw new Error(capacity.message);

    const role = args.role;
    const actorId = me.userId;
    const organizationId = me.organizationId;
    if (!organizationId) throw new Error("Your account is not associated with an organization");
    let branchId = args.branchId;

    if (me.role === "manager") {
      if (role !== "cashier") throw new Error("Managers can only create cashiers");
      if (!me.branchId) throw new Error("Your account has no branch assignment");
      branchId = me.branchId;
    }

    let assignedBranchId: Id<"branches">;
    if (branchId) {
      assignedBranchId = branchId;
    } else if (me.branchId) {
      assignedBranchId = me.branchId;
    } else {
      throw new Error("No branch available. Complete organization onboarding first.");
    }

    const assignedBranch = await ctx.runQuery(api.branches.get, { id: assignedBranchId });
    if (
      !assignedBranch ||
      assignedBranch.organizationId !== organizationId ||
      assignedBranch.status !== "active"
    ) {
      throw new Error("Invalid branch");
    }

    const created = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: password },
      profile: { email, name },
    });

    await ctx.runMutation(internal.users.insertProfileForUser, {
      userId: created.user._id,
      name,
      role,
      branchId: assignedBranchId,
      phone: args.phone,
      actorId,
      organizationId,
    });

    return { userId: created.user._id };
  },
});

/**
 * One-time secure provisioning of the first administrator.
 * Requires Convex env `BOOTSTRAP_ADMIN_SECRET` and matching `bootstrapSecret` arg.
 * Refuses once any staff profile already exists.
 */
export const bootstrapAdministrator = action({
  args: {
    bootstrapSecret: v.string(),
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    if (process.env.BOOTSTRAP_ADMIN_ENABLED !== "true") {
      throw new Error("Administrator bootstrap is disabled. Use the organization onboarding flow.");
    }
    const expected = process.env.BOOTSTRAP_ADMIN_SECRET;
    if (!expected || args.bootstrapSecret !== expected) {
      throw new Error("Invalid bootstrap secret");
    }

    const status = await ctx.runQuery(internal.users.hasAnyStaffProfile, {});
    if (status.hasUsers) {
      throw new Error("Administrator already provisioned. Use Users to create more accounts.");
    }

    const email = args.email.trim().toLowerCase();
    const name = args.name.trim();
    const password = args.password;

    if (!email || !name) throw new Error("Name and email are required");
    if (
      !password ||
      password.length < 12 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      throw new Error(
        "Password must be at least 12 characters and include uppercase, lowercase, and a number",
      );
    }

    throw new Error("Use public signup and onboarding to create the first administrator.");
  },
});

/**
 * Admin or manager sets a new password for a user (no current-password check).
 * Managers may only reset cashiers in their own branch.
 */
export const resetUserPassword = action({
  args: {
    profileId: v.id("profiles"),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertPasswordPolicy(args.newPassword);

    const me = await ctx.runQuery(api.users.me, {});
    if (!me || (me.role !== "administrator" && me.role !== "manager")) {
      throw new Error("Only administrators or managers can reset passwords");
    }

    const target = await ctx.runQuery(api.users.get, { id: args.profileId });
    if (!target?.email) throw new Error("User email not found");

    if (me.role === "manager") {
      if (target.role !== "cashier" || target.branchId !== me.branchId) {
        throw new Error("Managers can only reset passwords for cashiers in their branch");
      }
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: target.email, secret: args.newPassword },
    });

    await invalidateSessions(ctx, { userId: target.userId });

    await ctx.runMutation(internal.users.writePasswordChangeAudit, {
      userId: me.userId,
    });

    await notifyPasswordChanged(target.email);

    return { ok: true as const };
  },
});
