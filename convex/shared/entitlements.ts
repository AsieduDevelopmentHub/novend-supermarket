import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  buildUsageMetric,
  deriveAccess,
  type LicenseAccess,
  type OrganizationStatus,
  type SubscriptionSnapshot,
  type UsageMetric,
} from "./licensing";
import {
  effectivePlanLimits,
  limitReachedMessage,
  resolvePlan,
  type LimitResource,
  type PlanDefinition,
  type PlanKey,
  type PlanLimits,
} from "./plans";

type Ctx = QueryCtx | MutationCtx;

export type OrganizationLicense = {
  organization: Doc<"organizations">;
  plan: PlanDefinition;
  planKey: PlanKey;
  /** Catalog limits with the Enterprise backup quota applied when one is set. */
  limits: PlanLimits;
  subscription: Doc<"subscriptions"> | null;
  access: LicenseAccess;
};

function toSnapshot(subscription: Doc<"subscriptions"> | null): SubscriptionSnapshot | null {
  if (!subscription) return null;
  return {
    status: subscription.status,
    isLifetime: subscription.isLifetime,
    expiresAt: subscription.expiresAt ?? null,
    graceUntil: subscription.graceUntil ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
  };
}

/**
 * The organization's current subscription. Organizations hold at most one live
 * subscription; older rows are kept for history and ignored here.
 */
export async function getActiveSubscription(ctx: Ctx, organization: Doc<"organizations">) {
  if (organization.subscriptionId) {
    const linked = await ctx.db.get(organization.subscriptionId);
    if (linked && linked.organizationId === organization._id) return linked;
  }
  const rows = await ctx.db
    .query("subscriptions")
    .withIndex("by_organization", (q) => q.eq("organizationId", organization._id))
    .collect();
  if (rows.length === 0) return null;
  return rows.sort((a, b) => b.createdAt - a.createdAt)[0];
}

export async function resolveLicense(
  ctx: Ctx,
  organization: Doc<"organizations">,
  now = Date.now(),
): Promise<OrganizationLicense> {
  const subscription = await getActiveSubscription(ctx, organization);
  const planKey = (subscription?.planKey ?? organization.planKey) as PlanKey | undefined;
  const plan = resolvePlan(planKey);
  const access = deriveAccess(
    organization.status as OrganizationStatus,
    toSnapshot(subscription),
    now,
  );
  return {
    organization,
    plan,
    planKey: plan.key,
    limits: effectivePlanLimits(plan, organization.backupLimitBytes, organization.limitOverrides),
    subscription,
    access,
  };
}

export type OrganizationUsage = Record<LimitResource, number>;

export async function countUsage(
  ctx: Ctx,
  organizationId: Id<"organizations">,
): Promise<OrganizationUsage> {
  const [products, profiles, branches, devices, backups] = await Promise.all([
    ctx.db
      .query("products")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect(),
    ctx.db
      .query("profiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect(),
    ctx.db
      .query("branches")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect(),
    ctx.db
      .query("devices")
      .withIndex("by_organization_active", (q) =>
        q.eq("organizationId", organizationId).eq("isActive", true),
      )
      .collect(),
    ctx.db
      .query("cloudBackups")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect(),
  ]);

  return {
    products: products.filter((product) => product.status !== "archived").length,
    users: profiles.filter((profile) => profile.status === "active").length,
    branches: branches.filter((branch) => branch.status === "active").length,
    devices: devices.length,
    backupBytes: backups.reduce((sum, backup) => sum + backup.sizeBytes, 0),
  };
}

export function buildUsageMetrics(limits: PlanLimits, usage: OrganizationUsage): UsageMetric[] {
  return (Object.keys(limits) as LimitResource[]).map((resource) =>
    buildUsageMetric(resource, usage[resource], limits[resource]),
  );
}

/** Counts only the resource being checked so create paths stay cheap. */
async function countResource(
  ctx: Ctx,
  organizationId: Id<"organizations">,
  resource: LimitResource,
): Promise<number> {
  switch (resource) {
    case "products": {
      const rows = await ctx.db
        .query("products")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
      return rows.filter((row) => row.status !== "archived").length;
    }
    case "users": {
      const rows = await ctx.db
        .query("profiles")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
      return rows.filter((row) => row.status === "active").length;
    }
    case "branches": {
      const rows = await ctx.db
        .query("branches")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
      return rows.filter((row) => row.status === "active").length;
    }
    case "devices": {
      const rows = await ctx.db
        .query("devices")
        .withIndex("by_organization_active", (q) =>
          q.eq("organizationId", organizationId).eq("isActive", true),
        )
        .collect();
      return rows.length;
    }
    case "backupBytes": {
      const rows = await ctx.db
        .query("cloudBackups")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
      return rows.reduce((sum, row) => sum + row.sizeBytes, 0);
    }
  }
}

/**
 * Blocks creating one more of a metered resource when the plan is full.
 * Existing records always keep working — only the new one is refused.
 */
export async function assertWithinLimit(
  ctx: Ctx,
  organizationId: Id<"organizations">,
  planKey: PlanKey,
  resource: LimitResource,
  additional = 1,
): Promise<void> {
  const organization = await ctx.db.get(organizationId);
  if (!organization) throw new Error("Organization not found");
  const plan = resolvePlan(planKey);
  const limit = effectivePlanLimits(
    plan,
    organization.backupLimitBytes,
    organization.limitOverrides,
  )[resource];
  if (limit === null) return;
  const used = await countResource(ctx, organizationId, resource);
  if (used + additional > limit) {
    throw new Error(limitReachedMessage(plan.key, resource, limit));
  }
}

/** Convenience wrapper used by mutations that already resolved the session. */
export async function assertOrganizationCapacity(
  ctx: Ctx,
  organization: Doc<"organizations">,
  resource: LimitResource,
  additional = 1,
): Promise<void> {
  const license = await resolveLicense(ctx, organization);
  await assertWithinLimit(ctx, organization._id, license.planKey, resource, additional);
}
