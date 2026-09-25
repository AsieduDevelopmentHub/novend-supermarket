/**
 * Recognized ARR/MRR for platform analytics.
 *
 * Only active and past_due subscriptions contribute. Trials are excluded until
 * first paid activation. Custom commercial offers override catalog list price.
 */

import {
  isCommercialOfferLive,
  offerPriceForCycle,
  type CommercialOfferDoc,
} from "./commercialOffers";
import { resolvePlan, type BillingCycle, type PlanKey } from "./plans";

export type MrrSubscriptionInput = {
  status: string;
  isLifetime: boolean;
  billingCycle: string;
  amount: number;
  planKey: PlanKey | string;
};

export type MrrOfferInput = Pick<
  CommercialOfferDoc,
  "status" | "validFrom" | "validUntil" | "monthlyPrice" | "yearlyPrice" | "allowedCycles"
>;

const MRR_STATUSES = new Set(["active", "past_due"]);

function asRecurringCycle(cycle: string): Extract<BillingCycle, "monthly" | "yearly"> | null {
  if (cycle === "monthly" || cycle === "yearly") return cycle;
  return null;
}

function normalizeToMonthly(amount: number, cycle: "monthly" | "yearly"): number {
  return cycle === "yearly" ? amount / 12 : amount;
}

/**
 * Monthly recurring GH₵ for one subscription.
 * Price order: subscription.amount (recognized) → live commercial offer → catalog.
 * Offer prices alone do not change MRR until applied onto the subscription.
 */
export function subscriptionMrr(
  sub: MrrSubscriptionInput,
  offer: MrrOfferInput | null = null,
  now = Date.now(),
): number {
  if (sub.isLifetime) return 0;
  if (!MRR_STATUSES.has(sub.status)) return 0;

  const cycle = asRecurringCycle(sub.billingCycle);
  if (!cycle) return 0;

  if (sub.amount > 0) {
    return normalizeToMonthly(sub.amount, cycle);
  }

  if (offer && isCommercialOfferLive(offer, now)) {
    const offerAmount = offerPriceForCycle(offer, cycle);
    if (offerAmount !== null && offerAmount > 0) {
      return normalizeToMonthly(offerAmount, cycle);
    }
  }

  const plan = resolvePlan(sub.planKey);
  if (cycle === "yearly" && plan.yearlyPrice) {
    return plan.yearlyPrice / 12;
  }
  if (plan.monthlyPrice) {
    return plan.monthlyPrice;
  }
  return 0;
}

/** Latest live offer per organization (active or accepted, still valid). */
export function indexLiveOffersByOrganization(
  offers: ReadonlyArray<CommercialOfferDoc>,
  now = Date.now(),
): Map<string, CommercialOfferDoc> {
  const byOrg = new Map<string, CommercialOfferDoc>();
  const sorted = [...offers].sort((a, b) => b.updatedAt - a.updatedAt);
  for (const offer of sorted) {
    if (!isCommercialOfferLive(offer, now)) continue;
    const key = String(offer.organizationId);
    if (!byOrg.has(key)) {
      byOrg.set(key, offer);
    }
  }
  return byOrg;
}
