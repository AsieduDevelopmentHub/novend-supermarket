import { describe, expect, it } from "vitest";
import {
  roleReceivesClockIn,
  roleReceivesTopic,
} from "@/convex/shared/notificationAudience";

describe("notification audience", () => {
  it("keeps cashiers on stock and transfers, not billing or the daily summary", () => {
    expect(roleReceivesTopic("cashier", "stock_alerts")).toBe(true);
    expect(roleReceivesTopic("cashier", "branch_transfers")).toBe(true);
    expect(roleReceivesTopic("cashier", "daily_summary")).toBe(false);
    expect(roleReceivesTopic("cashier", "subscription_alerts")).toBe(false);
  });

  it("limits subscription alerts to administrators", () => {
    expect(roleReceivesTopic("administrator", "subscription_alerts")).toBe(true);
    expect(roleReceivesTopic("manager", "subscription_alerts")).toBe(false);
  });

  it("sends clock-in alerts to supervisors only", () => {
    expect(roleReceivesClockIn("administrator")).toBe(true);
    expect(roleReceivesClockIn("manager")).toBe(true);
    expect(roleReceivesClockIn("cashier")).toBe(false);
  });
});
