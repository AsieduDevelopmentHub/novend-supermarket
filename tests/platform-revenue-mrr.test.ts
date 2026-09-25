import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  indexLiveOffersByOrganization,
  subscriptionMrr,
} from "@/convex/shared/platformRevenue";
import { PLAN_CATALOG } from "@/convex/shared/plans";

const NOW = Date.parse("2026-09-24T12:00:00.000Z");

function sub(overrides: Partial<Parameters<typeof subscriptionMrr>[0]> = {}) {
  return {
    status: "active",
    isLifetime: false,
    billingCycle: "monthly",
    amount: 0,
    planKey: "pro",
    ...overrides,
  };
}

function offer(
  overrides: Partial<Doc<"commercialOffers">> = {},
): Doc<"commercialOffers"> {
  return {
    _id: "jd7offer000000000000000000" as Id<"commercialOffers">,
    _creationTime: NOW,
    organizationId: "jd7org00000000000000000000" as Id<"organizations">,
    name: "Negotiated Pro",
    status: "accepted",
    basePlanKey: "pro",
    currency: "GHS",
    monthlyPrice: 300,
    yearlyPrice: 3000,
    allowedCycles: ["monthly", "yearly"],
    validFrom: NOW - 60_000,
    createdBy: "jd7user0000000000000000000" as Id<"users">,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("subscriptionMrr recognized revenue", () => {
  it("excludes trialing subscriptions even when catalog would price them", () => {
    expect(
      subscriptionMrr(
        sub({ status: "trialing", amount: 0, planKey: "pro" }),
        null,
        NOW,
      ),
    ).toBe(0);
    expect(PLAN_CATALOG.pro.monthlyPrice).toBeGreaterThan(0);
  });

  it("includes active catalog subscriptions when amount is unset", () => {
    expect(subscriptionMrr(sub({ amount: 0, planKey: "pro" }), null, NOW)).toBe(
      PLAN_CATALOG.pro.monthlyPrice,
    );
  });

  it("normalizes yearly catalog and subscription amounts to monthly", () => {
    expect(
      subscriptionMrr(
        sub({ billingCycle: "yearly", amount: 0, planKey: "pro" }),
        null,
        NOW,
      ),
    ).toBe((PLAN_CATALOG.pro.yearlyPrice ?? 0) / 12);

    expect(
      subscriptionMrr(
        sub({ billingCycle: "yearly", amount: 2400, planKey: "basic" }),
        null,
        NOW,
      ),
    ).toBe(200);
  });

  it("prefers subscription amount over live commercial offer for recognized MRR", () => {
    expect(
      subscriptionMrr(
        sub({ amount: 450, planKey: "pro" }),
        offer({ monthlyPrice: 300 }),
        NOW,
      ),
    ).toBe(450);
  });

  it("uses live commercial offer when subscription amount is unset", () => {
    expect(
      subscriptionMrr(
        sub({ amount: 0, planKey: "pro" }),
        offer({ monthlyPrice: 300 }),
        NOW,
      ),
    ).toBe(300);

    expect(
      subscriptionMrr(
        sub({ billingCycle: "yearly", amount: 0, planKey: "pro" }),
        offer({ yearlyPrice: 2400 }),
        NOW,
      ),
    ).toBe(200);
  });

  it("includes past_due and excludes lifetime", () => {
    expect(
      subscriptionMrr(sub({ status: "past_due", amount: 450 }), null, NOW),
    ).toBe(450);
    expect(
      subscriptionMrr(sub({ isLifetime: true, amount: 5000, planKey: "lifetime" }), null, NOW),
    ).toBe(0);
  });

  it("ignores expired or draft offers and falls back to amount then catalog", () => {
    expect(
      subscriptionMrr(
        sub({ amount: 400 }),
        offer({ status: "draft", monthlyPrice: 100 }),
        NOW,
      ),
    ).toBe(400);

    expect(
      subscriptionMrr(
        sub({ amount: 0 }),
        offer({ validUntil: NOW - 1, monthlyPrice: 100 }),
        NOW,
      ),
    ).toBe(PLAN_CATALOG.pro.monthlyPrice);
  });
});

describe("indexLiveOffersByOrganization", () => {
  it("keeps the latest live offer per organization", () => {
    const older = offer({
      _id: "jd7offer111111111111111111" as Id<"commercialOffers">,
      updatedAt: NOW - 10_000,
      monthlyPrice: 200,
    });
    const newer = offer({
      _id: "jd7offer222222222222222222" as Id<"commercialOffers">,
      updatedAt: NOW,
      monthlyPrice: 350,
    });
    const otherOrg = offer({
      organizationId: "jd7org11111111111111111111" as Id<"organizations">,
      monthlyPrice: 99,
    });
    const map = indexLiveOffersByOrganization([older, newer, otherOrg], NOW);
    expect(map.get("jd7org00000000000000000000")?.monthlyPrice).toBe(350);
    expect(map.get("jd7org11111111111111111111")?.monthlyPrice).toBe(99);
  });
});
