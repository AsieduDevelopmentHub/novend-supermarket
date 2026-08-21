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

export default crons;
