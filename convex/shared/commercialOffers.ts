/**
 * Pure helpers for private commercial offers (custom tenant pricing).
 * Public catalog prices never come from this module.
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { BillingCycle, SellablePlanKey } from "./plans";

export type CommercialOfferDoc = Doc<"commercialOffers">;

export type TenantCommercialOffer = {
  _id: Id<"commercialOffers">;
  name: string;
  status: CommercialOfferDoc["status"];
  basePlanKey: SellablePlanKey;
  currency: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  allowedCycles: Array<"monthly" | "yearly">;
  customerMessage: string | null;
  validFrom: number;
  validUntil: number | null;
  acceptedAt: number | null;
};

/** Active or accepted offers that are currently within their validity window. */
export function isCommercialOfferLive(
  offer: Pick<CommercialOfferDoc, "status" | "validFrom" | "validUntil">,
  now = Date.now(),
): boolean {
  if (offer.status !== "active" && offer.status !== "accepted") return false;
  if (offer.validFrom > now) return false;
  if (offer.validUntil !== undefined && offer.validUntil < now) return false;
  return true;
}

export function offerPriceForCycle(
  offer: Pick<CommercialOfferDoc, "monthlyPrice" | "yearlyPrice" | "allowedCycles">,
  cycle: BillingCycle,
): number | null {
  if (cycle !== "monthly" && cycle !== "yearly") return null;
  if (!offer.allowedCycles.includes(cycle)) return null;
  if (cycle === "monthly") {
    return offer.monthlyPrice !== undefined ? offer.monthlyPrice : null;
  }
  return offer.yearlyPrice !== undefined ? offer.yearlyPrice : null;
}

/** Whether checkout for this catalog plan + cycle should use the private offer. */
export function offerAppliesToCheckout(
  offer: Pick<
    CommercialOfferDoc,
    | "basePlanKey"
    | "monthlyPrice"
    | "yearlyPrice"
    | "allowedCycles"
    | "status"
    | "validFrom"
    | "validUntil"
  >,
  planKey: string,
  cycle: BillingCycle,
  now = Date.now(),
): boolean {
  if (!isCommercialOfferLive(offer, now)) return false;
  if (offer.basePlanKey !== planKey) return false;
  return offerPriceForCycle(offer, cycle) !== null;
}

/** Tenant-safe projection — never includes internal notes or gateway codes. */
export function toTenantCommercialOffer(offer: CommercialOfferDoc): TenantCommercialOffer {
  return {
    _id: offer._id,
    name: offer.name,
    status: offer.status,
    basePlanKey: offer.basePlanKey,
    currency: offer.currency,
    monthlyPrice: offer.monthlyPrice ?? null,
    yearlyPrice: offer.yearlyPrice ?? null,
    allowedCycles: [...offer.allowedCycles],
    customerMessage: offer.customerMessage ?? null,
    validFrom: offer.validFrom,
    validUntil: offer.validUntil ?? null,
    acceptedAt: offer.acceptedAt ?? null,
  };
}

/** Latest live offer for an organization (active or accepted, still valid). */
export async function loadLiveOfferForOrganization(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  now = Date.now(),
): Promise<Doc<"commercialOffers"> | null> {
  const rows = await ctx.db
    .query("commercialOffers")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  const live = rows
    .filter((row) => isCommercialOfferLive(row, now))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return live[0] ?? null;
}
