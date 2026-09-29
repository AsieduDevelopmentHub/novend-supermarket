/**
 * Dining UI copy derived from central business terminology.
 * Prefer `useBusinessTerms` for new call sites; this bridge keeps dining views typed.
 */

import {
  floorViewCopy,
  kitchenViewCopy,
  resolveBusinessTerms,
  type BusinessTermsMap,
} from "@/convex/shared/businessTerms";
import type { IndustryProfile } from "@/convex/shared/businessCapabilities";

export type DiningBusinessTerms = {
  kitchenNav: string;
  kitchenTitle: string;
  kitchenDescription: string;
  kitchenOffline: string;
  kitchenDisabledTitle: string;
  kitchenDisabledDescription: string;
  kitchenLoading: string;
  kitchenEmptyTitle: string;
  kitchenEmptyDescription: string;
  check: string;
  checkLower: string;
  openCheck: string;
  emptyCheck: string;
  addToCheck: string;
  openCheckError: string;
  addedToCheck: string;
  floorTitle: string;
  floorDescription: string;
  floorDisabledDescription: string;
  sendKitchen: string;
};

export function diningTermsFromMap(terms: BusinessTermsMap): DiningBusinessTerms {
  const floor = floorViewCopy(terms);
  const kitchen = kitchenViewCopy(terms);
  const checkLower = terms.check.toLowerCase();
  return {
    kitchenNav: terms.kitchen,
    kitchenTitle: kitchen.title,
    kitchenDescription: kitchen.description,
    kitchenOffline: `${terms.kitchen} needs a connection`,
    kitchenDisabledTitle: `${terms.kitchen} not enabled`,
    kitchenDisabledDescription:
      "Turn on Kitchen tickets in Settings → Selling options, or apply the Restaurant / Bar pack.",
    kitchenLoading: `Loading ${terms.kitchen.toLowerCase()}…`,
    kitchenEmptyTitle: `No open ${terms.ticket_plural.toLowerCase()}`,
    kitchenEmptyDescription: "Fired orders will appear here.",
    check: terms.check,
    checkLower,
    openCheck: `Open ${checkLower}`,
    emptyCheck: `Empty ${checkLower}`,
    addToCheck: `Add to ${checkLower}`,
    openCheckError: `Could not open ${checkLower}`,
    addedToCheck: `Added to ${checkLower}`,
    floorTitle: floor.title,
    floorDescription: floor.description,
    floorDisabledDescription:
      "Turn on Tables & open checks in Settings → Selling options, or apply the Restaurant / Bar pack.",
    sendKitchen: terms.kitchen.toLowerCase().includes("bar")
      ? "Send to bar"
      : `Send ${terms.kitchen.toLowerCase()}`,
  };
}

export function diningTermsForIndustry(
  industryProfile?: IndustryProfile | string | null,
): DiningBusinessTerms {
  return diningTermsFromMap(resolveBusinessTerms(industryProfile));
}

/** Prefer `useBusinessTerms` + `diningTermsFromMap` when overrides are needed. */
export function useDiningBusinessTerms(
  industryProfile?: IndustryProfile | string | null,
): DiningBusinessTerms {
  return diningTermsForIndustry(industryProfile);
}
