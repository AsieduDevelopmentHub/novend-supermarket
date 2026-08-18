import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id, TableNames } from "../_generated/dataModel";
import { findDefaultBranch } from "./defaultBranch";

type Ctx = QueryCtx | MutationCtx;

export type AppRole = "administrator" | "manager" | "cashier";

type OrgDoc = { organizationId: Id<"organizations"> };

export async function getAuthUserOrNull(ctx: Ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return await ctx.db.get(userId);
}

export async function getPlatformAdmin(ctx: Ctx, userId: Id<"users">) {
  return await ctx.db
    .query("platformAdmins")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export async function requirePlatformAdmin(ctx: Ctx) {
  const { userId, user } = await requireAuth(ctx);
  const admin = await getPlatformAdmin(ctx, userId);
  if (!admin) {
    throw new Error("Forbidden");
  }
  return { userId, user };
}

export async function requireAuth(ctx: Ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("Unauthenticated");
  }
  return { userId, user };
}

export async function getProfileByUserId(ctx: Ctx, userId: Id<"users">) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export async function requireProfile(ctx: Ctx) {
  const { userId, user } = await requireAuth(ctx);
  const profile = await getProfileByUserId(ctx, userId);
  if (!profile || profile.status !== "active") {
    throw new Error("Forbidden");
  }
  const organization = await ctx.db.get(profile.organizationId);
  if (!organization || organization.status !== "active") {
    throw new Error("Organization is inactive");
  }
  return { userId, user, profile, organizationId: profile.organizationId, organization };
}

export async function requireOrgContext(ctx: Ctx) {
  return await requireProfile(ctx);
}

export function assertOrgDoc<T extends OrgDoc | null>(
  doc: T,
  organizationId: Id<"organizations">,
): asserts doc is Exclude<T, null> {
  if (!doc || doc.organizationId !== organizationId) {
    throw new Error("Not found");
  }
}

export async function requireOrgDoc<T extends TableNames>(
  ctx: Ctx,
  id: Id<T>,
  organizationId: Id<"organizations">,
) {
  const doc = await ctx.db.get(id);
  if (!doc || !("organizationId" in doc) || doc.organizationId !== organizationId) {
    throw new Error("Not found");
  }
  return doc;
}

export async function requireRole(ctx: Ctx, roles: AppRole[]) {
  const session = await requireProfile(ctx);
  if (!roles.includes(session.profile.role as AppRole)) {
    throw new Error("Forbidden");
  }
  return session;
}

export function isAdmin(profile: Doc<"profiles">) {
  return profile.role === "administrator";
}

export function isManager(profile: Doc<"profiles">) {
  return profile.role === "manager";
}

export function canManageCatalog(profile: Doc<"profiles">) {
  return profile.role === "administrator" || profile.role === "manager";
}

export function canViewCostPrice(profile: Doc<"profiles">) {
  return profile.role === "administrator" || profile.role === "manager";
}

export function canManageUsers(profile: Doc<"profiles">) {
  return profile.role === "administrator" || profile.role === "manager";
}

export function canManageBranches(profile: Doc<"profiles">) {
  return profile.role === "administrator";
}

export function canWriteSettings(profile: Doc<"profiles">) {
  return profile.role === "administrator";
}

export function activeBranchId(profile: Doc<"profiles">): Id<"branches"> | null {
  return profile.branchId ?? null;
}

export async function resolveWorkingBranchId(
  ctx: Ctx,
  profile: Doc<"profiles">,
  requested?: Id<"branches"> | null,
): Promise<Id<"branches">> {
  if (isAdmin(profile)) {
    if (requested) {
      const branch = await ctx.db.get(requested);
      assertOrgDoc(branch, profile.organizationId);
      return requested;
    }
    if (profile.branchId) return profile.branchId;
    const main = await findDefaultBranch(ctx, profile.organizationId);
    if (!main) {
      throw new Error("No branch configured. Complete onboarding first.");
    }
    return main._id;
  }

  if (!profile.branchId) {
    throw new Error("No branch assigned to this user");
  }
  if (requested && requested !== profile.branchId) {
    throw new Error("Forbidden: branch access denied");
  }
  return profile.branchId;
}

export async function requireBranchId(
  ctx: Ctx,
  requested?: Id<"branches"> | null,
): Promise<{
  userId: Id<"users">;
  user: Doc<"users">;
  profile: Doc<"profiles">;
  organizationId: Id<"organizations">;
  branchId: Id<"branches">;
}> {
  const session = await requireProfile(ctx);
  const branchId = await resolveWorkingBranchId(ctx, session.profile, requested);
  const branch = await ctx.db.get(branchId);
  assertOrgDoc(branch, session.organizationId);
  return { ...session, branchId };
}

export function assertBranchAccess(profile: Doc<"profiles">, branchId: Id<"branches">) {
  if (isAdmin(profile)) return;
  if (profile.branchId !== branchId) {
    throw new Error("Forbidden: branch access denied");
  }
}

export async function requireBranchAccess(ctx: Ctx, branchId: Id<"branches">) {
  const session = await requireProfile(ctx);
  assertBranchAccess(session.profile, branchId);
  const branch = await ctx.db.get(branchId);
  assertOrgDoc(branch, session.organizationId);
  return session;
}

export function resolveBranchFilter(
  profile: Doc<"profiles">,
  requested?: Id<"branches"> | null,
): Id<"branches"> | null {
  if (isAdmin(profile)) {
    return requested ?? null;
  }
  if (!profile.branchId) {
    throw new Error("No branch assigned to this user");
  }
  if (requested && requested !== profile.branchId) {
    throw new Error("Forbidden: branch access denied");
  }
  return profile.branchId;
}

