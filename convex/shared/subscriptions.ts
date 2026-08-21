import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { writeAuditLog } from "./audit";
import { getActiveSubscription } from "./entitlements";
import { GRACE_PERIOD_MS, TRIAL_PERIOD_MS } from "./licensing";
import { PLAN_CATALOG, PLAN_LIST, type BillingCycle, type PlanKey } from "./plans";
import { periodEnd } from "./billingPeriod";

export { periodEnd };

/** Mirrors the code catalog into the `plans` table. Idempotent. */
export async function ensurePlanCatalogRows(ctx: MutationCtx): Promise<void> {
  const now = Date.now();
  for (const plan of PLAN_LIST) {
    const existing = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", plan.key))
      .unique();
    const row = {
      key: plan.key,
      name: plan.name,
      description: plan.tagline,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      oneTimePrice: plan.oneTimePrice,
      currency: "GHS",
      productLimit: plan.limits.products,
      userLimit: plan.limits.users,
      branchLimit: plan.limits.branches,
      deviceLimit: plan.limits.devices,
      backupLimitBytes: plan.limits.backupBytes,
      features: plan.features,
      isLifetime: plan.isLifetime,
      sortOrder: plan.sortOrder,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, row);
    } else {
      await ctx.db.insert("plans", row);
    }
  }
}

export async function planRowId(
  ctx: MutationCtx,
  planKey: PlanKey,
): Promise<Id<"plans"> | undefined> {
  const row = await ctx.db
    .query("plans")
    .withIndex("by_key", (q) => q.eq("key", planKey))
    .unique();
  return row?._id;
}

export type ActivationArgs = {
  organizationId: Id<"organizations">;
  planKey: PlanKey;
  cycle: BillingCycle;
  amount: number;
  currency: string;
  gateway: "none" | "paystack" | "manual";
  gatewayCustomerCode?: string;
  gatewaySubscriptionCode?: string;
  gatewayEmailToken?: string;
  gatewayPlanCode?: string;
  startsAt?: number;
  actorId?: Id<"users">;
};

/**
 * Creates or renews an organization's subscription and re-points the
 * organization at the resulting plan. Gateway callbacks, webhooks and platform
 * overrides all funnel through here so entitlements stay consistent.
 */
export async function activateSubscription(
  ctx: MutationCtx,
  args: ActivationArgs,
): Promise<Id<"subscriptions">> {
  const organization = await ctx.db.get(args.organizationId);
  if (!organization) throw new Error("Organization not found");

  await ensurePlanCatalogRows(ctx);

  const now = args.startsAt ?? Date.now();
  const plan = PLAN_CATALOG[args.planKey];
  const isLifetime = plan.isLifetime || args.cycle === "lifetime";
  const expiresAt = isLifetime ? undefined : periodEnd(now, args.cycle);
  const existing = await getActiveSubscription(ctx, organization);
  const planId = await planRowId(ctx, args.planKey);

  const fields = {
    planKey: args.planKey,
    planId,
    status: "active" as const,
    billingCycle: args.cycle,
    isLifetime,
    startsAt: now,
    expiresAt,
    nextBillingDate: expiresAt,
    graceUntil: expiresAt ? expiresAt + GRACE_PERIOD_MS : undefined,
    cancelAtPeriodEnd: false,
    cancelledAt: undefined,
    amount: args.amount,
    currency: args.currency,
    paymentGateway: args.gateway,
    gatewayCustomerCode: args.gatewayCustomerCode,
    gatewaySubscriptionCode: args.gatewaySubscriptionCode,
    gatewayEmailToken: args.gatewayEmailToken,
    gatewayPlanCode: args.gatewayPlanCode,
    updatedAt: now,
  };

  let subscriptionId: Id<"subscriptions">;
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    subscriptionId = existing._id;
  } else {
    subscriptionId = await ctx.db.insert("subscriptions", {
      organizationId: args.organizationId,
      createdAt: now,
      ...fields,
    });
  }

  await ctx.db.patch(args.organizationId, {
    planKey: args.planKey,
    activePlanId: planId,
    subscriptionId,
    status: "active",
    plan: args.planKey,
    trialEndsAt: undefined,
    updatedAt: now,
  });

  await writeAuditLog(ctx, {
    organizationId: args.organizationId,
    actorId: args.actorId,
    action: "billing_subscription_activated",
    entityType: "subscriptions",
    entityId: subscriptionId,
    metadata: {
      planKey: args.planKey,
      cycle: args.cycle,
      gateway: args.gateway,
      amount: args.amount,
      expiresAt: expiresAt ?? null,
    },
  });

  return subscriptionId;
}

/** Puts a freshly provisioned organization on a time-limited trial. */
export async function startTrial(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  planKey: PlanKey = "pro",
): Promise<Id<"subscriptions">> {
  await ensurePlanCatalogRows(ctx);
  const now = Date.now();
  const endsAt = now + TRIAL_PERIOD_MS;
  const planId = await planRowId(ctx, planKey);
  const subscriptionId = await ctx.db.insert("subscriptions", {
    organizationId,
    planKey,
    planId,
    status: "trialing",
    billingCycle: "monthly",
    isLifetime: false,
    startsAt: now,
    expiresAt: endsAt,
    nextBillingDate: endsAt,
    graceUntil: endsAt,
    amount: 0,
    currency: "GHS",
    paymentGateway: "none",
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.patch(organizationId, {
    planKey,
    activePlanId: planId,
    subscriptionId,
    status: "trial",
    plan: planKey,
    trialEndsAt: endsAt,
    updatedAt: now,
  });
  return subscriptionId;
}
