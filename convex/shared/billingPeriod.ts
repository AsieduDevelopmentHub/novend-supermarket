/**
 * Subscription period arithmetic. Pure so it can be unit-tested without Convex.
 */

import type { BillingCycle } from "./plans";

function addMonths(from: number, months: number): number {
  const date = new Date(from);
  const targetDay = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + months);
  // Clamp end-of-month rollovers so 31 Jan + 1 month is 28/29 Feb, not 3 March.
  if (date.getUTCDate() < targetDay) {
    date.setUTCDate(0);
  }
  return date.getTime();
}

export function periodEnd(from: number, cycle: BillingCycle): number | undefined {
  if (cycle === "lifetime") return undefined;
  return addMonths(from, cycle === "yearly" ? 12 : 1);
}
