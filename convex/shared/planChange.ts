/**
 * Plan-change previews and proration. Pure so Convex, the UI, and tests share
 * one calculation. The charged amount still comes from a Convex query — this
 * module is the formula, not a client-side authority.
 */

import type { AccessState } from "./licensing";
import {
  PLAN_CATALOG,
  planChangeKind,
  priceForCycle,
  usageExceedsLimits,
  type BillingCycle,
  type LimitResource,
  type PlanKey,
  type PlanUsageExcess,
} from "./plans";

export type PlanChangeIntent = "same" | "cancel_scheduled" | "downgrade" | "upgrade" | "purchase";

export type ScheduledChangeSnapshot = {
  type: "downgrade";
  targetPlanKey: PlanKey;
  targetCycle: BillingCycle;
  effectiveAt: number;
  createdAt: number;
  status: "scheduled";
};

export type PlanChangeInput = {
  currentPlanKey: PlanKey;
  targetPlanKey: PlanKey;
  targetCycle: BillingCycle;
  now: number;
  accessState: AccessState;
  currentCycle: BillingCycle | null;
  startsAt: number | null;
  expiresAt: number | null;
  isLifetime: boolean;
  scheduled: ScheduledChangeSnapshot | null;
  usage: Partial<Record<LimitResource, number>>;
};

export type PlanChangePreview = {
  intent: PlanChangeIntent;
  currentPlanKey: PlanKey;
  currentPlanName: string;
  currentPrice: number | null;
  targetPlanKey: PlanKey;
  targetPlanName: string;
  targetPrice: number;
  cycle: BillingCycle;
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
  remainingMs: number;
  remainingRatio: number;
  currentCredit: number;
  newPlanRemainingCost: number;
  amountDueToday: number;
  nextBillingAmount: number | null;
  nextBillingDate: number | null;
  keepPeriod: boolean;
  chargeToday: boolean;
  usageWarning: PlanUsageExcess[];
  scheduled: ScheduledChangeSnapshot | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function remainingDays(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / MS_PER_DAY));
}

function hasPaidRemainder(input: PlanChangeInput): boolean {
  if (input.accessState !== "active") return false;
  if (input.isLifetime) return false;
  if (!input.startsAt || !input.expiresAt) return false;
  return input.expiresAt > input.now;
}

function catalogPrice(planKey: PlanKey, cycle: BillingCycle): number | null {
  return priceForCycle(PLAN_CATALOG[planKey], cycle);
}

/**
 * Unused value of the current plan versus remaining value of the target plan
 * for the same leftover fraction of the billing period.
 *
 * amountDue = max(0, remainingNew − unusedCurrent)
 */
export function prorateUpgrade(args: {
  currentPrice: number;
  newPrice: number;
  startsAt: number;
  expiresAt: number;
  now: number;
}): {
  remainingMs: number;
  remainingRatio: number;
  currentCredit: number;
  newPlanRemainingCost: number;
  amountDueToday: number;
} {
  const periodMs = Math.max(0, args.expiresAt - args.startsAt);
  const remainingMs = Math.max(0, args.expiresAt - args.now);
  const remainingRatio = periodMs === 0 ? 0 : Math.min(1, remainingMs / periodMs);
  const currentCredit = roundMoney(args.currentPrice * remainingRatio);
  const newPlanRemainingCost = roundMoney(args.newPrice * remainingRatio);
  return {
    remainingMs,
    remainingRatio,
    currentCredit,
    newPlanRemainingCost,
    amountDueToday: roundMoney(Math.max(0, newPlanRemainingCost - currentCredit)),
  };
}

export function computePlanChangePreview(input: PlanChangeInput): PlanChangePreview {
  const current = PLAN_CATALOG[input.currentPlanKey];
  const target = PLAN_CATALOG[input.targetPlanKey];
  const targetPrice = catalogPrice(input.targetPlanKey, input.targetCycle);
  if (targetPrice === null) {
    throw new Error(`The ${target.name} plan is not sold on a ${input.targetCycle} cycle.`);
  }

  const currentPrice =
    input.currentCycle && !input.isLifetime
      ? catalogPrice(input.currentPlanKey, input.currentCycle)
      : input.isLifetime
        ? current.oneTimePrice
        : null;

  const rank = planChangeKind(input.currentPlanKey, input.targetPlanKey);
  const usageWarning = usageExceedsLimits(input.usage, target.limits);
  const paidRemainder = hasPaidRemainder(input);

  const base = {
    currentPlanKey: input.currentPlanKey,
    currentPlanName: current.name,
    currentPrice,
    targetPlanKey: input.targetPlanKey,
    targetPlanName: target.name,
    targetPrice,
    cycle: input.targetCycle,
    currentPeriodStart: input.startsAt,
    currentPeriodEnd: input.expiresAt,
    remainingMs: paidRemainder && input.expiresAt ? Math.max(0, input.expiresAt - input.now) : 0,
    remainingRatio: 0,
    currentCredit: 0,
    newPlanRemainingCost: 0,
    amountDueToday: targetPrice,
    nextBillingAmount: target.isLifetime ? null : targetPrice,
    nextBillingDate: input.expiresAt,
    keepPeriod: false,
    chargeToday: true,
    usageWarning,
    scheduled: input.scheduled,
  };

  if (rank === "same") {
    if (input.scheduled) {
      return {
        ...base,
        intent: "cancel_scheduled",
        amountDueToday: 0,
        chargeToday: false,
        nextBillingAmount: currentPrice,
        nextBillingDate: input.expiresAt,
      };
    }
    if (
      input.accessState === "trial" ||
      input.accessState === "grace" ||
      input.accessState === "expired"
    ) {
      return { ...base, intent: "purchase" };
    }
    return {
      ...base,
      intent: "same",
      amountDueToday: 0,
      chargeToday: false,
      nextBillingAmount: currentPrice,
    };
  }

  if (rank === "downgrade") {
    if (!paidRemainder) {
      return { ...base, intent: "purchase" };
    }
    return {
      ...base,
      intent: "downgrade",
      amountDueToday: 0,
      chargeToday: false,
      keepPeriod: true,
      nextBillingAmount: targetPrice,
      nextBillingDate: input.expiresAt,
    };
  }

  // Upgrade — always from the active plan, never from a scheduled downgrade.
  if (
    paidRemainder &&
    currentPrice !== null &&
    input.startsAt &&
    input.expiresAt &&
    !target.isLifetime
  ) {
    const proration = prorateUpgrade({
      currentPrice,
      newPrice: targetPrice,
      startsAt: input.startsAt,
      expiresAt: input.expiresAt,
      now: input.now,
    });
    return {
      ...base,
      intent: "upgrade",
      ...proration,
      keepPeriod: true,
      chargeToday: proration.amountDueToday > 0,
      nextBillingAmount: targetPrice,
      nextBillingDate: input.expiresAt,
    };
  }

  if (
    paidRemainder &&
    currentPrice !== null &&
    target.isLifetime &&
    input.startsAt &&
    input.expiresAt
  ) {
    const proration = prorateUpgrade({
      currentPrice,
      newPrice: targetPrice,
      startsAt: input.startsAt,
      expiresAt: input.expiresAt,
      now: input.now,
    });
    return {
      ...base,
      intent: "upgrade",
      ...proration,
      keepPeriod: false,
      chargeToday: proration.amountDueToday > 0,
      nextBillingAmount: null,
      nextBillingDate: null,
    };
  }

  return { ...base, intent: "purchase" };
}

export function scheduledChangeEquals(
  current: ScheduledChangeSnapshot | null | undefined,
  targetPlanKey: PlanKey,
  targetCycle: BillingCycle,
  effectiveAt: number,
): boolean {
  if (!current || current.status !== "scheduled") return false;
  return (
    current.targetPlanKey === targetPlanKey &&
    current.targetCycle === targetCycle &&
    current.effectiveAt === effectiveAt
  );
}
