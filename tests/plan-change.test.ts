import { describe, expect, it } from "vitest";
import {
  computePlanChangePreview,
  prorateUpgrade,
  remainingDays,
  roundMoney,
  scheduledChangeEquals,
} from "@/convex/shared/planChange";
import { planChangeKind, usageExceedsLimits } from "@/convex/shared/plans";

const AUG_23 = Date.UTC(2026, 7, 23, 10);
const SEP_23 = Date.UTC(2026, 8, 23, 10);
const MIDPOINT = Date.UTC(2026, 8, 7, 10);

const scheduledBasic = {
  type: "downgrade" as const,
  targetPlanKey: "basic" as const,
  targetCycle: "monthly" as const,
  effectiveAt: SEP_23,
  createdAt: AUG_23,
  status: "scheduled" as const,
};

describe("planChangeKind", () => {
  it("ranks catalog upgrades and downgrades", () => {
    expect(planChangeKind("basic", "pro")).toBe("upgrade");
    expect(planChangeKind("pro", "enterprise")).toBe("upgrade");
    expect(planChangeKind("pro", "basic")).toBe("downgrade");
    expect(planChangeKind("pro", "pro")).toBe("same");
  });
});

describe("prorateUpgrade", () => {
  it("charges the remaining new-plan value minus unused current credit", () => {
    const result = prorateUpgrade({
      currentPrice: 200,
      newPrice: 400,
      startsAt: AUG_23,
      expiresAt: SEP_23,
      now: MIDPOINT,
    });
    expect(result.remainingRatio).toBeGreaterThan(0.4);
    expect(result.remainingRatio).toBeLessThan(0.6);
    expect(result.amountDueToday).toBe(
      roundMoney(result.newPlanRemainingCost - result.currentCredit),
    );
    expect(result.amountDueToday).toBeGreaterThan(90);
    expect(result.amountDueToday).toBeLessThan(110);
  });
});

describe("computePlanChangePreview", () => {
  const paidPro = {
    currentPlanKey: "pro" as const,
    targetCycle: "monthly" as const,
    now: AUG_23 + 10 * 60 * 1000,
    accessState: "active" as const,
    currentCycle: "monthly" as const,
    startsAt: AUG_23,
    expiresAt: SEP_23,
    isLifetime: false,
    scheduled: null,
    usage: { products: 10, users: 2, branches: 1, devices: 1, backupBytes: 0 },
  };

  it("upgrades Basic → Pro with a prorated amount due today", () => {
    const preview = computePlanChangePreview({
      ...paidPro,
      currentPlanKey: "basic",
      targetPlanKey: "pro",
      now: MIDPOINT,
    });
    expect(preview.intent).toBe("upgrade");
    expect(preview.keepPeriod).toBe(true);
    expect(preview.chargeToday).toBe(true);
    expect(preview.amountDueToday).toBeGreaterThan(0);
    expect(preview.amountDueToday).toBeLessThan(450);
    expect(preview.nextBillingAmount).toBe(450);
    expect(preview.nextBillingDate).toBe(SEP_23);
  });

  it("upgrades Pro → Enterprise from the active Pro plan", () => {
    const preview = computePlanChangePreview({
      ...paidPro,
      targetPlanKey: "enterprise",
      now: MIDPOINT,
    });
    expect(preview.intent).toBe("upgrade");
    expect(preview.currentPlanKey).toBe("pro");
    expect(preview.targetPlanKey).toBe("enterprise");
    expect(preview.amountDueToday).toBeGreaterThan(0);
  });

  it("schedules Pro → Basic at period end with no charge", () => {
    const preview = computePlanChangePreview({
      ...paidPro,
      targetPlanKey: "basic",
    });
    expect(preview.intent).toBe("downgrade");
    expect(preview.amountDueToday).toBe(0);
    expect(preview.chargeToday).toBe(false);
    expect(preview.nextBillingAmount).toBe(200);
    expect(preview.nextBillingDate).toBe(SEP_23);
  });

  it("cancels a scheduled downgrade when the current plan is selected again", () => {
    const preview = computePlanChangePreview({
      ...paidPro,
      targetPlanKey: "pro",
      scheduled: scheduledBasic,
    });
    expect(preview.intent).toBe("cancel_scheduled");
    expect(preview.amountDueToday).toBe(0);
    expect(preview.chargeToday).toBe(false);
  });

  it("upgrades from the current Pro plan even when Basic is scheduled", () => {
    const preview = computePlanChangePreview({
      ...paidPro,
      targetPlanKey: "enterprise",
      scheduled: scheduledBasic,
      now: MIDPOINT,
    });
    expect(preview.intent).toBe("upgrade");
    expect(preview.currentPlanKey).toBe("pro");
    expect(preview.currentPrice).toBe(450);
  });

  it("treats trial conversion as a full-price purchase, not a downgrade schedule", () => {
    const preview = computePlanChangePreview({
      ...paidPro,
      accessState: "trial",
      targetPlanKey: "basic",
    });
    expect(preview.intent).toBe("purchase");
    expect(preview.amountDueToday).toBe(200);
    expect(preview.keepPeriod).toBe(false);
  });

  it("does not treat same-plan active as a new charge", () => {
    const preview = computePlanChangePreview({
      ...paidPro,
      targetPlanKey: "pro",
    });
    expect(preview.intent).toBe("same");
    expect(preview.chargeToday).toBe(false);
    expect(preview.amountDueToday).toBe(0);
  });

  it("warns when usage exceeds the target plan without blocking the preview", () => {
    const preview = computePlanChangePreview({
      ...paidPro,
      targetPlanKey: "basic",
      usage: { products: 3200, users: 8, branches: 2, devices: 7, backupBytes: 300 * 1024 * 1024 },
    });
    expect(preview.intent).toBe("downgrade");
    expect(preview.usageWarning.length).toBeGreaterThan(0);
    expect(preview.usageWarning.some((row) => row.resource === "products")).toBe(true);
  });
});

describe("usageExceedsLimits", () => {
  it("never treats unlimited resources as excess", () => {
    expect(
      usageExceedsLimits(
        { products: 99999 },
        { products: null, users: 3, branches: 1, devices: 3, backupBytes: 1 },
      ),
    ).toEqual([]);
  });
});

describe("scheduledChangeEquals", () => {
  it("is idempotent for the same target, cycle, and effective date", () => {
    expect(scheduledChangeEquals(scheduledBasic, "basic", "monthly", SEP_23)).toBe(true);
    expect(scheduledChangeEquals(scheduledBasic, "basic", "yearly", SEP_23)).toBe(false);
    expect(scheduledChangeEquals(null, "basic", "monthly", SEP_23)).toBe(false);
  });
});

describe("remainingDays", () => {
  it("rounds leftover time up to whole days", () => {
    expect(remainingDays(1)).toBe(1);
    expect(remainingDays(0)).toBe(0);
  });
});
