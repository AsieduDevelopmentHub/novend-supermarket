import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { billingCycleValidator, planKeyValidator, paymentGatewayValidator } from "./schema";
import { requireSessionIgnoringLicense, requirePlatformAdmin } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import {
  buildUsageMetrics,
  countUsage,
  getActiveSubscription,
  resolveLicense,
} from "./shared/entitlements";
import { GRACE_PERIOD_MS } from "./shared/licensing";
import {
  DEFAULT_PLAN_KEY,
  PLAN_CATALOG,
  PLAN_LIST,
  parseCustomBackupGb,
  priceForCycle,
  supportsCycle,
  type BillingCycle,
  type PlanKey,
} from "./shared/plans";
import {
  activeProviderId,
  getBillingProvider,
  type BillingProviderId,
} from "./shared/billingProvider";
import { buildReference, ensureRecurringPlan, isPaystackConfigured } from "./shared/paystack";
import {
  activateSubscription,
  ensurePlanCatalogRows,
  periodEnd,
  startTrial as startTrialForOrganization,
} from "./shared/subscriptions";

/** Keeps the `plans` table aligned with the code catalog. */
export const ensurePlanCatalog = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ensurePlanCatalogRows(ctx);
  },
});

// ---------------------------------------------------------------------------
// Tenant queries
// ---------------------------------------------------------------------------

/**
 * Compact licence payload used by banners and the offline cache. Available to
 * every signed-in user because the whole app reacts to it.
 */
export const licenseSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const { organization } = await requireSessionIgnoringLicense(ctx);
    const license = await resolveLicense(ctx, organization);
    return {
      organizationId: organization._id,
      organizationName: organization.name,
      organizationStatus: organization.status,
      planKey: license.planKey,
      planName: license.plan.name,
      access: license.access,
      limits: license.limits,
      features: license.plan.features,
      subscription: license.subscription
        ? {
            status: license.subscription.status,
            isLifetime: license.subscription.isLifetime,
            billingCycle: license.subscription.billingCycle,
            expiresAt: license.subscription.expiresAt ?? null,
            nextBillingDate: license.subscription.nextBillingDate ?? null,
            graceUntil: license.subscription.graceUntil ?? null,
            cancelAtPeriodEnd: license.subscription.cancelAtPeriodEnd ?? false,
          }
        : null,
      issuedAt: Date.now(),
    };
  },
});

/**
 * Usage against plan limits, for the inline notices on list screens.
 *
 * Managers can see this because they are the ones who hit product and device
 * limits day to day; it exposes counts only, never pricing or payment data.
 */
export const usageSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const { organization, profile } = await requireSessionIgnoringLicense(ctx);
    if (profile.role === "cashier") throw new Error("Forbidden");
    const license = await resolveLicense(ctx, organization);
    const usage = await countUsage(ctx, organization._id);
    return {
      planKey: license.planKey,
      planName: license.plan.name,
      usage: buildUsageMetrics(license.limits, usage),
    };
  },
});

/** Full billing dashboard payload. Administrators only. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const { organization, profile } = await requireSessionIgnoringLicense(ctx);
    if (profile.role !== "administrator") {
      throw new Error("Forbidden");
    }
    const license = await resolveLicense(ctx, organization);
    const usage = await countUsage(ctx, organization._id);
    const metrics = buildUsageMetrics(license.limits, usage);

    return {
      organizationId: organization._id,
      organizationName: organization.name,
      organizationStatus: organization.status,
      currency: organization.currency,
      planKey: license.planKey,
      plan: {
        key: license.plan.key,
        name: license.plan.name,
        tagline: license.plan.tagline,
        isLifetime: license.plan.isLifetime,
        features: license.plan.features,
      },
      access: license.access,
      trialEndsAt: organization.trialEndsAt ?? null,
      subscription: license.subscription
        ? {
            id: license.subscription._id,
            status: license.subscription.status,
            billingCycle: license.subscription.billingCycle,
            isLifetime: license.subscription.isLifetime,
            startsAt: license.subscription.startsAt,
            expiresAt: license.subscription.expiresAt ?? null,
            nextBillingDate: license.subscription.nextBillingDate ?? null,
            amount: license.subscription.amount,
            currency: license.subscription.currency,
            paymentGateway: license.subscription.paymentGateway,
            cancelAtPeriodEnd: license.subscription.cancelAtPeriodEnd ?? false,
          }
        : null,
      usage: metrics,
      onlinePaymentsEnabled: isPaystackConfigured(),
    };
  },
});

export const history = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { organizationId, profile } = await requireSessionIgnoringLicense(ctx);
    if (profile.role !== "administrator") throw new Error("Forbidden");
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    const rows = await ctx.db
      .query("billingHistory")
      .withIndex("by_organization_createdAt", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(limit);
    return rows.map((row) => ({
      id: row._id,
      amount: row.amount,
      currency: row.currency,
      gateway: row.gateway,
      reference: row.reference,
      status: row.status,
      description: row.description,
      planKey: row.planKey ?? null,
      billingCycle: row.billingCycle ?? null,
      paidAt: row.paidAt ?? null,
      createdAt: row.createdAt,
    }));
  },
});

/** Public plan catalog with the gateway codes needed for checkout. */
export const catalog = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("plans").collect();
    const codes = new Map(rows.map((row) => [row.key, row]));
    return {
      onlinePaymentsEnabled: isPaystackConfigured(),
      plans: PLAN_LIST.map((plan) => ({
        key: plan.key,
        name: plan.name,
        tagline: plan.tagline,
        audience: plan.audience,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        oneTimePrice: plan.oneTimePrice,
        priceFrom: plan.priceFrom,
        isLifetime: plan.isLifetime,
        featured: plan.featured,
        selfServe: plan.selfServe,
        limits: plan.limits,
        features: plan.features,
        hasMonthlyCode: Boolean(codes.get(plan.key)?.gatewayMonthlyPlanCode),
        hasYearlyCode: Boolean(codes.get(plan.key)?.gatewayYearlyPlanCode),
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export const checkoutContext = internalQuery({
  args: { planKey: planKeyValidator, cycle: billingCycleValidator },
  handler: async (ctx, args) => {
    const session = await requireSessionIgnoringLicense(ctx);
    if (session.profile.role !== "administrator") {
      throw new Error("Only administrators can manage billing");
    }
    const planRow = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", args.planKey))
      .unique();
    return {
      organizationId: session.organizationId,
      organizationName: session.organization.name,
      currency: session.organization.currency || "GHS",
      email: session.user.email ?? null,
      userId: session.userId,
      gatewayPlanCode:
        args.cycle === "monthly"
          ? (planRow?.gatewayMonthlyPlanCode ?? null)
          : args.cycle === "yearly"
            ? (planRow?.gatewayYearlyPlanCode ?? null)
            : null,
    };
  },
});

export const checkoutByReference = internalQuery({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("billingHistory")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .unique();
  },
});

export const recordCheckoutAttempt = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    reference: v.string(),
    planKey: planKeyValidator,
    cycle: billingCycleValidator,
    amount: v.number(),
    currency: v.string(),
    gateway: paymentGatewayValidator,
    description: v.string(),
    initiatedBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("billingHistory", {
      organizationId: args.organizationId,
      planKey: args.planKey,
      billingCycle: args.cycle,
      amount: args.amount,
      currency: args.currency,
      gateway: args.gateway,
      reference: args.reference,
      status: "pending",
      description: args.description,
      initiatedBy: args.initiatedBy,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Applies a confirmed payment. Idempotent on `reference` so the callback page
 * and the webhook can both run without double-activating.
 */
export const applySuccessfulPayment = internalMutation({
  args: {
    reference: v.string(),
    organizationId: v.optional(v.id("organizations")),
    planKey: v.optional(planKeyValidator),
    cycle: v.optional(billingCycleValidator),
    amount: v.number(),
    currency: v.string(),
    paidAt: v.optional(v.number()),
    gateway: paymentGatewayValidator,
    gatewayCustomerCode: v.optional(v.string()),
    gatewaySubscriptionCode: v.optional(v.string()),
    gatewayEmailToken: v.optional(v.string()),
    gatewayPlanCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("billingHistory")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .unique();

    const organizationId = record?.organizationId ?? args.organizationId;
    const planKey = (record?.planKey ?? args.planKey) as PlanKey | undefined;
    const cycle = (record?.billingCycle ?? args.cycle) as BillingCycle | undefined;

    if (!organizationId || !planKey || !cycle) {
      // Unknown reference: keep the money trail, do not guess an activation.
      return { applied: false as const };
    }

    if (record?.status === "success") {
      return { applied: false as const, alreadyApplied: true as const };
    }

    const now = Date.now();
    if (record) {
      await ctx.db.patch(record._id, {
        status: "success",
        amount: args.amount || record.amount,
        paidAt: args.paidAt ?? now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("billingHistory", {
        organizationId,
        planKey,
        billingCycle: cycle,
        amount: args.amount,
        currency: args.currency,
        gateway: args.gateway,
        reference: args.reference,
        status: "success",
        description: `${PLAN_CATALOG[planKey].name} — ${cycle}`,
        paidAt: args.paidAt ?? now,
        createdAt: now,
        updatedAt: now,
      });
    }

    const subscriptionId = await activateSubscription(ctx, {
      organizationId,
      planKey,
      cycle,
      amount: args.amount,
      currency: args.currency,
      gateway: args.gateway,
      gatewayCustomerCode: args.gatewayCustomerCode,
      gatewaySubscriptionCode: args.gatewaySubscriptionCode,
      gatewayEmailToken: args.gatewayEmailToken,
      gatewayPlanCode: args.gatewayPlanCode,
      startsAt: args.paidAt ?? now,
    });

    if (record) {
      await ctx.db.patch(record._id, { subscriptionId });
    }
    return { applied: true as const, organizationId, planKey };
  },
});

export const markPaymentStatus = internalMutation({
  args: {
    reference: v.string(),
    status: v.union(v.literal("failed"), v.literal("abandoned"), v.literal("refunded")),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("billingHistory")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .unique();
    if (!record || record.status === "success") return;
    await ctx.db.patch(record._id, { status: args.status, updatedAt: Date.now() });
  },
});

/**
 * Starts a checkout for the signed-in organization.
 *
 * Works while a business is suspended or expired — renewing is exactly what a
 * locked-out administrator needs to do.
 */
export const startCheckout = action({
  args: { planKey: planKeyValidator, cycle: billingCycleValidator },
  handler: async (
    ctx,
    args,
  ): Promise<{ kind: "redirect"; url: string; reference: string } | { kind: "activated" }> => {
    const plan = PLAN_CATALOG[args.planKey];
    if (!supportsCycle(plan, args.cycle)) {
      throw new Error(`The ${plan.name} plan is not sold on a ${args.cycle} cycle.`);
    }
    if (!plan.selfServe) {
      throw new Error(`The ${plan.name} plan is not available for self-service checkout.`);
    }
    const amount = priceForCycle(plan, args.cycle);
    if (amount === null) throw new Error("This plan has no price for that cycle.");

    const context = await ctx.runQuery(internal.billing.checkoutContext, {
      planKey: args.planKey,
      cycle: args.cycle,
    });
    if (!context.email) {
      throw new Error("Add an email address to your account before starting a payment.");
    }

    const providerId: BillingProviderId = activeProviderId();
    const provider = getBillingProvider(providerId);
    const reference = buildReference("NVD");

    await ctx.runMutation(internal.billing.recordCheckoutAttempt, {
      organizationId: context.organizationId,
      reference,
      planKey: args.planKey,
      cycle: args.cycle,
      amount,
      currency: context.currency,
      gateway: providerId === "paystack" ? "paystack" : "manual",
      description: `${plan.name} — ${args.cycle === "lifetime" ? "one-time licence" : args.cycle}`,
      initiatedBy: context.userId,
    });

    const siteUrl = process.env.NOVEND_SITE_URL ?? process.env.SITE_URL ?? "http://localhost:3000";
    let gatewayPlanCode = context.gatewayPlanCode ?? undefined;
    if (providerId === "paystack" && (args.cycle === "monthly" || args.cycle === "yearly")) {
      const ensuredCode = await ensureRecurringPlan({
        existingCode: gatewayPlanCode,
        name: `Novend ${plan.name} (${args.cycle === "yearly" ? "Yearly" : "Monthly"})`,
        amount,
        interval: args.cycle === "yearly" ? "annually" : "monthly",
        currency: context.currency,
        description: plan.tagline,
      });
      if (ensuredCode !== gatewayPlanCode) {
        await ctx.runMutation(internal.billing.savePlanGatewayCodes, {
          planKey: args.planKey,
          ...(args.cycle === "monthly" ? { monthlyCode: ensuredCode } : { yearlyCode: ensuredCode }),
        });
      }
      gatewayPlanCode = ensuredCode;
    }

    const result = await provider.createSubscription({
      email: context.email,
      planKey: args.planKey,
      cycle: args.cycle,
      amount,
      currency: context.currency,
      reference,
      callbackUrl: `${siteUrl.replace(/\/$/, "")}/billing/callback`,
      planCode: gatewayPlanCode,
      metadata: {
        organizationId: context.organizationId,
        organizationName: context.organizationName,
        planKey: args.planKey,
        cycle: args.cycle,
      },
    });

    if (result.kind === "activated") {
      await ctx.runMutation(internal.billing.applySuccessfulPayment, {
        reference,
        organizationId: context.organizationId,
        planKey: args.planKey,
        cycle: args.cycle,
        amount,
        currency: context.currency,
        gateway: "manual",
      });
      return { kind: "activated" };
    }

    return { kind: "redirect", url: result.url, reference: result.reference };
  },
});

/** Called by the checkout callback page. Safe to call more than once. */
export const verifyCheckout = action({
  args: { reference: v.string() },
  handler: async (ctx, args): Promise<{ paid: boolean; planKey: PlanKey | null }> => {
    const existing = await ctx.runQuery(internal.billing.checkoutByReference, {
      reference: args.reference,
    });
    if (!existing) {
      throw new Error("This payment reference is not recognized.");
    }

    const provider = getBillingProvider();
    const verification = await provider.verifyPayment(args.reference);
    if (!verification.paid) {
      await ctx.runMutation(internal.billing.markPaymentStatus, {
        reference: args.reference,
        status: "failed",
      });
      return { paid: false, planKey: null };
    }

    const applied = await ctx.runMutation(internal.billing.applySuccessfulPayment, {
      reference: verification.reference,
      amount: verification.amount,
      currency: verification.currency,
      paidAt: verification.paidAt ?? undefined,
      gateway: provider.id === "paystack" ? "paystack" : "manual",
      gatewayCustomerCode: verification.gatewayCustomerCode ?? undefined,
      gatewayPlanCode: verification.gatewayPlanCode ?? undefined,
    });

    return { paid: true, planKey: applied.applied ? applied.planKey : null };
  },
});

export const cancelSubscriptionRecord = internalMutation({
  args: { organizationId: v.id("organizations"), actorId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) throw new Error("Organization not found");
    const subscription = await getActiveSubscription(ctx, organization);
    if (!subscription) throw new Error("There is no active subscription to cancel.");
    if (subscription.isLifetime) {
      throw new Error("A lifetime licence does not renew, so there is nothing to cancel.");
    }
    const now = Date.now();
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
      metadata: { effectiveAt: subscription.expiresAt ?? null },
    });
    return {
      gatewaySubscriptionCode: subscription.gatewaySubscriptionCode ?? null,
      gatewayEmailToken: subscription.gatewayEmailToken ?? null,
      endsAt: subscription.expiresAt ?? null,
    };
  },
});

export const cancelSubscription = action({
  args: {},
  handler: async (ctx): Promise<{ endsAt: number | null }> => {
    const context = await ctx.runQuery(internal.billing.checkoutContext, {
      planKey: DEFAULT_PLAN_KEY,
      cycle: "lifetime",
    });
    const result = await ctx.runMutation(internal.billing.cancelSubscriptionRecord, {
      organizationId: context.organizationId,
      actorId: context.userId,
    });
    const provider = getBillingProvider();
    await provider.cancelSubscription({
      gatewaySubscriptionCode: result.gatewaySubscriptionCode,
      gatewayEmailToken: result.gatewayEmailToken,
    });
    return { endsAt: result.endsAt };
  },
});

// ---------------------------------------------------------------------------
// Webhook handling
// ---------------------------------------------------------------------------

/** Finds the subscription a gateway event belongs to, newest first. */
async function findSubscriptionForEvent(
  ctx: MutationCtx,
  args: {
    gatewaySubscriptionCode?: string;
    gatewayCustomerCode?: string;
    organizationId?: Id<"organizations">;
  },
): Promise<Doc<"subscriptions"> | null> {
  if (args.gatewaySubscriptionCode) {
    const bySubscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_gatewaySubscriptionCode", (q) =>
        q.eq("gatewaySubscriptionCode", args.gatewaySubscriptionCode),
      )
      .unique();
    if (bySubscription) return bySubscription;
  }
  if (args.gatewayCustomerCode) {
    const byCustomer = await ctx.db
      .query("subscriptions")
      .withIndex("by_gatewayCustomerCode", (q) =>
        q.eq("gatewayCustomerCode", args.gatewayCustomerCode),
      )
      .collect();
    if (byCustomer.length > 0) {
      return byCustomer.sort((a, b) => b.createdAt - a.createdAt)[0];
    }
  }
  if (args.organizationId) {
    const organization = await ctx.db.get(args.organizationId);
    if (organization) return await getActiveSubscription(ctx, organization);
  }
  return null;
}

export const linkGatewaySubscription = internalMutation({
  args: {
    gatewaySubscriptionCode: v.string(),
    gatewayEmailToken: v.optional(v.string()),
    gatewayCustomerCode: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
    nextBillingDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const subscription = await findSubscriptionForEvent(ctx, args);
    if (!subscription) return { linked: false as const };

    await ctx.db.patch(subscription._id, {
      gatewaySubscriptionCode: args.gatewaySubscriptionCode,
      gatewayEmailToken: args.gatewayEmailToken ?? subscription.gatewayEmailToken,
      gatewayCustomerCode: args.gatewayCustomerCode ?? subscription.gatewayCustomerCode,
      nextBillingDate: args.nextBillingDate ?? subscription.nextBillingDate,
      updatedAt: Date.now(),
    });
    return { linked: true as const };
  },
});

/**
 * Extends a subscription after Paystack charges a renewal. Renewal charges carry
 * a gateway-generated reference, so they are matched by subscription or customer
 * code rather than by our checkout reference.
 */
export const applyGatewayRenewal = internalMutation({
  args: {
    reference: v.string(),
    amount: v.number(),
    currency: v.string(),
    paidAt: v.optional(v.number()),
    gatewaySubscriptionCode: v.optional(v.string()),
    gatewayCustomerCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const duplicate = await ctx.db
      .query("billingHistory")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .unique();
    if (duplicate?.status === "success") return { applied: false as const };

    const subscription = await findSubscriptionForEvent(ctx, args);
    if (!subscription) return { applied: false as const };

    const paidAt = args.paidAt ?? Date.now();
    const nextEnd = periodEnd(
      Math.max(paidAt, subscription.expiresAt ?? paidAt),
      subscription.billingCycle,
    );

    await ctx.db.patch(subscription._id, {
      status: "active",
      expiresAt: nextEnd,
      nextBillingDate: nextEnd,
      graceUntil: nextEnd ? nextEnd + GRACE_PERIOD_MS : undefined,
      updatedAt: paidAt,
    });

    const organization = await ctx.db.get(subscription.organizationId);
    if (organization && organization.status !== "disabled" && organization.status !== "inactive") {
      await ctx.db.patch(organization._id, { status: "active", updatedAt: paidAt });
    }

    const now = Date.now();
    if (duplicate) {
      await ctx.db.patch(duplicate._id, { status: "success", paidAt, updatedAt: now });
    } else {
      await ctx.db.insert("billingHistory", {
        organizationId: subscription.organizationId,
        subscriptionId: subscription._id,
        planKey: subscription.planKey,
        billingCycle: subscription.billingCycle,
        amount: args.amount,
        currency: args.currency,
        gateway: "paystack",
        reference: args.reference,
        status: "success",
        description: `${PLAN_CATALOG[subscription.planKey].name} renewal`,
        paidAt,
        createdAt: now,
        updatedAt: now,
      });
    }

    await writeAuditLog(ctx, {
      organizationId: subscription.organizationId,
      action: "billing_subscription_renewed",
      entityType: "subscriptions",
      entityId: subscription._id,
      metadata: { amount: args.amount, expiresAt: nextEnd ?? null },
    });
    return { applied: true as const };
  },
});

export const markSubscriptionPastDue = internalMutation({
  args: { gatewaySubscriptionCode: v.string() },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_gatewaySubscriptionCode", (q) =>
        q.eq("gatewaySubscriptionCode", args.gatewaySubscriptionCode),
      )
      .unique();
    if (!subscription) return;
    const now = Date.now();
    await ctx.db.patch(subscription._id, {
      status: "past_due",
      graceUntil: (subscription.expiresAt ?? now) + GRACE_PERIOD_MS,
      updatedAt: now,
    });
    await writeAuditLog(ctx, {
      organizationId: subscription.organizationId,
      action: "billing_payment_failed",
      entityType: "subscriptions",
      entityId: subscription._id,
    });
  },
});

export const disableGatewaySubscription = internalMutation({
  args: { gatewaySubscriptionCode: v.string() },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_gatewaySubscriptionCode", (q) =>
        q.eq("gatewaySubscriptionCode", args.gatewaySubscriptionCode),
      )
      .unique();
    if (!subscription || subscription.isLifetime) return;
    const now = Date.now();
    await ctx.db.patch(subscription._id, {
      status: "cancelled",
      cancelAtPeriodEnd: true,
      cancelledAt: now,
      nextBillingDate: undefined,
      updatedAt: now,
    });
    await writeAuditLog(ctx, {
      organizationId: subscription.organizationId,
      action: "billing_subscription_disabled",
      entityType: "subscriptions",
      entityId: subscription._id,
    });
  },
});

// ---------------------------------------------------------------------------
// Scheduled maintenance
// ---------------------------------------------------------------------------

/** Moves lapsed subscriptions (past their grace window) into read-only. */
export const expireLapsedSubscriptions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    let expired = 0;
    for (const subscription of subscriptions) {
      if (subscription.isLifetime || !subscription.expiresAt) continue;
      const graceUntil = subscription.graceUntil ?? subscription.expiresAt + GRACE_PERIOD_MS;
      if (now <= graceUntil) continue;

      await ctx.db.patch(subscription._id, { status: "expired", updatedAt: now });
      const organization = await ctx.db.get(subscription.organizationId);
      if (organization && organization.status === "active") {
        await ctx.db.patch(organization._id, { status: "expired", updatedAt: now });
      }
      await writeAuditLog(ctx, {
        organizationId: subscription.organizationId,
        action: "billing_subscription_expired",
        entityType: "subscriptions",
        entityId: subscription._id,
      });
      expired += 1;
    }
    return { expired };
  },
});

/** Ends trials that ran out and leaves the business in read-only. */
export const expireTrials = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const organizations = await ctx.db
      .query("organizations")
      .withIndex("by_status", (q) => q.eq("status", "trial"))
      .collect();
    let expired = 0;
    for (const organization of organizations) {
      if (!organization.trialEndsAt || now <= organization.trialEndsAt) continue;
      await ctx.db.patch(organization._id, { status: "expired", updatedAt: now });
      const subscription = await getActiveSubscription(ctx, organization);
      if (subscription && !subscription.isLifetime) {
        await ctx.db.patch(subscription._id, { status: "expired", updatedAt: now });
      }
      expired += 1;
    }
    return { expired };
  },
});

export const dailyMaintenance = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    await ctx.runMutation(internal.billing.ensurePlanCatalog, {});
    if (isPaystackConfigured()) {
      await ctx.runAction(internal.billing.syncGatewayPlansInternal, {});
    }
    await ctx.runMutation(internal.billing.expireLapsedSubscriptions, {});
    await ctx.runMutation(internal.billing.expireTrials, {});
  },
});

// ---------------------------------------------------------------------------
// Platform administration
// ---------------------------------------------------------------------------

export const savePlanGatewayCodes = internalMutation({
  args: {
    planKey: planKeyValidator,
    monthlyCode: v.optional(v.string()),
    yearlyCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", args.planKey))
      .unique();
    if (!row) return;
    await ctx.db.patch(row._id, {
      gatewayMonthlyPlanCode: args.monthlyCode ?? row.gatewayMonthlyPlanCode,
      gatewayYearlyPlanCode: args.yearlyCode ?? row.gatewayYearlyPlanCode,
      updatedAt: Date.now(),
    });
  },
});

export const assertPlatformAdmin = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    return true;
  },
});

export const storedGatewayPlanCodes = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("plans").collect();
    return rows.map((row) => ({
      key: row.key,
      monthlyCode: row.gatewayMonthlyPlanCode ?? null,
      yearlyCode: row.gatewayYearlyPlanCode ?? null,
    }));
  },
});

/**
 * Creates or updates the recurring plans inside Paystack so checkout amounts
 * match the code catalog. Paystack ignores the initialize `amount` when a plan
 * code is present, so stale gateway plans would charge the old price.
 */
export const syncGatewayPlansInternal = internalAction({
  args: {},
  handler: async (ctx): Promise<{ synced: string[] }> => {
    if (!isPaystackConfigured()) {
      throw new Error("Set PAYSTACK_SECRET_KEY in the Convex deployment first.");
    }
    await ctx.runMutation(internal.billing.ensurePlanCatalog, {});
    const existing = await ctx.runQuery(internal.billing.storedGatewayPlanCodes, {});
    const byKey = new Map(existing.map((row) => [row.key, row]));
    const synced: string[] = [];

    for (const plan of PLAN_LIST) {
      if (plan.isLifetime) continue;
      const current = byKey.get(plan.key);
      let monthlyCode = current?.monthlyCode ?? undefined;
      let yearlyCode = current?.yearlyCode ?? undefined;

      if (plan.monthlyPrice !== null) {
        monthlyCode = await ensureRecurringPlan({
          existingCode: monthlyCode,
          name: `Novend ${plan.name} (Monthly)`,
          amount: plan.monthlyPrice,
          interval: "monthly",
          currency: "GHS",
          description: plan.tagline,
        });
      }
      if (plan.yearlyPrice !== null) {
        yearlyCode = await ensureRecurringPlan({
          existingCode: yearlyCode,
          name: `Novend ${plan.name} (Yearly)`,
          amount: plan.yearlyPrice,
          interval: "annually",
          currency: "GHS",
          description: plan.tagline,
        });
      }

      await ctx.runMutation(internal.billing.savePlanGatewayCodes, {
        planKey: plan.key,
        monthlyCode,
        yearlyCode,
      });
      synced.push(plan.key);
    }
    return { synced };
  },
});

/** Platform-admin entry point for the same sync. */
export const syncGatewayPlans = action({
  args: {},
  handler: async (ctx): Promise<{ synced: string[] }> => {
    await ctx.runQuery(internal.billing.assertPlatformAdmin, {});
    return await ctx.runAction(internal.billing.syncGatewayPlansInternal, {});
  },
});

/** Platform admin grants or changes a plan without a gateway payment. */
export const assignPlan = mutation({
  args: {
    organizationId: v.id("organizations"),
    planKey: planKeyValidator,
    cycle: billingCycleValidator,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) throw new Error("Organization not found");
    const plan = PLAN_CATALOG[args.planKey];
    if (!supportsCycle(plan, args.cycle)) {
      throw new Error(`The ${plan.name} plan is not sold on a ${args.cycle} cycle.`);
    }
    const amount = priceForCycle(plan, args.cycle) ?? 0;
    const now = Date.now();

    const subscriptionId = await activateSubscription(ctx, {
      organizationId: args.organizationId,
      planKey: args.planKey,
      cycle: args.cycle,
      amount,
      currency: organization.currency || "GHS",
      gateway: "manual",
      actorId: userId,
    });

    await ctx.db.insert("billingHistory", {
      organizationId: args.organizationId,
      subscriptionId,
      planKey: args.planKey,
      billingCycle: args.cycle,
      amount,
      currency: organization.currency || "GHS",
      gateway: "manual",
      reference: buildReference("MANUAL"),
      status: "success",
      description: args.note?.trim() || `${plan.name} assigned by Novend`,
      paidAt: now,
      initiatedBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    return subscriptionId;
  },
});

/**
 * Sets the Enterprise cloud backup quota for one organization.
 *
 * Catalog plans never publish a fixed Enterprise size. Empty / null means no cap.
 * The quota is ignored if the organization is not on a variable-backup plan.
 */
export const setBackupLimit = mutation({
  args: {
    organizationId: v.id("organizations"),
    backupLimitGb: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) throw new Error("Organization not found");
    const license = await resolveLicense(ctx, organization);
    if (!license.plan.variableBackup) {
      throw new Error("Custom cloud backup is only available on Enterprise.");
    }
    const backupLimitBytes = parseCustomBackupGb(args.backupLimitGb);
    await ctx.db.patch(organization._id, {
      backupLimitBytes,
      updatedAt: Date.now(),
    });
    await writeAuditLog(ctx, {
      organizationId: organization._id,
      actorId: userId,
      action: "platform_set_backup_limit",
      entityType: "organizations",
      entityId: organization._id,
      metadata: { backupLimitGb: args.backupLimitGb, backupLimitBytes },
    });
    return { backupLimitBytes };
  },
});

/**
 * Clears device registrations so a business can re-activate its terminals.
 * Used when hardware is replaced or a device list is stuck.
 */
export const resetActivation = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { userId } = await requirePlatformAdmin(ctx);
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_organization_active", (q) =>
        q.eq("organizationId", args.organizationId).eq("isActive", true),
      )
      .collect();
    const now = Date.now();
    for (const device of devices) {
      await ctx.db.patch(device._id, {
        isActive: false,
        deactivatedAt: now,
        deactivatedBy: userId,
      });
    }
    await writeAuditLog(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      action: "platform_reset_activation",
      entityType: "organizations",
      entityId: args.organizationId,
      metadata: { deactivated: devices.length },
    });
    return { deactivated: devices.length };
  },
});

/** Starts a trial for an organization that has no paid plan yet. */
export const startTrial = mutation({
  args: { organizationId: v.id("organizations"), planKey: v.optional(planKeyValidator) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    return await startTrialForOrganization(ctx, args.organizationId, args.planKey ?? "pro");
  },
});

/** Usage snapshot for the platform dashboard. */
export const organizationLicense = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) return null;
    const license = await resolveLicense(ctx, organization);
    const usage = await countUsage(ctx, organization._id);
    const payments = await ctx.db
      .query("billingHistory")
      .withIndex("by_organization_createdAt", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .take(10);

    return {
      planKey: license.planKey,
      planName: license.plan.name,
      variableBackup: license.plan.variableBackup,
      backupLimitBytes: organization.backupLimitBytes ?? null,
      access: license.access,
      status: organization.status,
      trialEndsAt: organization.trialEndsAt ?? null,
      subscription: license.subscription
        ? {
            status: license.subscription.status,
            billingCycle: license.subscription.billingCycle,
            isLifetime: license.subscription.isLifetime,
            startsAt: license.subscription.startsAt,
            expiresAt: license.subscription.expiresAt ?? null,
            nextBillingDate: license.subscription.nextBillingDate ?? null,
            amount: license.subscription.amount,
            currency: license.subscription.currency,
            paymentGateway: license.subscription.paymentGateway,
          }
        : null,
      usage: buildUsageMetrics(license.limits, usage),
      payments: payments.map((row) => ({
        id: row._id,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        gateway: row.gateway,
        reference: row.reference,
        description: row.description,
        createdAt: row.createdAt,
      })),
    };
  },
});
