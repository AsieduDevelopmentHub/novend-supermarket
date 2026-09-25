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
 *
 * Catalog list price is only a fallback for fixed self-serve plans with no live
 * commercial offer. Negotiated/enterprise (`priceFrom`) orgs with amount 0 must
 * not invent MRR from the public starting price (that produced phantom ₵625).
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

  const liveOffer = offer && isCommercialOfferLive(offer, now) ? offer : null;
  if (liveOffer) {
    const offerAmount = offerPriceForCycle(liveOffer, cycle);
    if (offerAmount !== null && offerAmount > 0) {
      return normalizeToMonthly(offerAmount, cycle);
    }
    // Negotiated tenant: unset offer/sub amount is not recognized revenue.
    return 0;
  }

  const plan = resolvePlan(sub.planKey);
  // Enterprise (and other quote-from plans) never contribute catalog list MRR.
  if (plan.priceFrom) return 0;

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
