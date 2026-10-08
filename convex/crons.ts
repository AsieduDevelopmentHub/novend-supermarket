import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Licensing housekeeping: keeps the plan catalog in sync and moves lapsed
 * subscriptions and finished trials into read-only once their grace window ends.
 */
crons.daily(
  "billing maintenance",
  { hourUTC: 2, minuteUTC: 0 },
  internal.billing.dailyMaintenance,
  {},
);

crons.interval(
  "pending payment reconciliation",
  { hours: 1 },
  internal.billing.reconcilePendingPayments,
  {},
);

crons.daily(
  "platform telemetry retention",
  { hourUTC: 3, minuteUTC: 0 },
  internal.telemetry.maintenance,
  {},
);

crons.daily(
  "account closure finalization",
  { hourUTC: 4, minuteUTC: 0 },
  internal.accountClosure.finalizeDueClosures,
  {},
);

crons.daily(
  "push alert digests",
  { hourUTC: 7, minuteUTC: 0 },
  internal.pushDispatch.runDailyAlertDigests,
  {},
);

/** 21:00 UTC is 9pm in Africa/Accra, after the till day has closed. */
crons.daily(
  "daily sales reports",
  { hourUTC: 21, minuteUTC: 0 },
  internal.dailySalesDigest.runDailySalesReports,
  {},
);

export default crons;
