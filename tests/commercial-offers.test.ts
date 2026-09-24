import { describe, expect, it } from "vitest";
import {
  isCommercialOfferLive,
  offerAppliesToCheckout,
  offerPriceForCycle,
  toTenantCommercialOffer,
} from "@/convex/shared/commercialOffers";
import type { Doc, Id } from "@/convex/_generated/dataModel";

function sampleOffer(
  overrides: Partial<Doc<"commercialOffers">> = {},
): Doc<"commercialOffers"> {
  const now = Date.now();
  return {
    _id: "jd7offer000000000000000000" as Id<"commercialOffers">,
    _creationTime: now,
    organizationId: "jd7org00000000000000000000" as Id<"organizations">,
    name: "Negotiated Pro",
    status: "active",
    basePlanKey: "pro",
    currency: "GHS",
    monthlyPrice: 300,
    yearlyPrice: 3000,
    allowedCycles: ["monthly", "yearly"],
    validFrom: now - 60_000,
    createdBy: "jd7user0000000000000000000" as Id<"users">,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("commercial offer pricing helpers", () => {
  it("treats active and accepted offers inside the validity window as live", () => {
    const now = Date.now();
    expect(isCommercialOfferLive(sampleOffer({ status: "active" }), now)).toBe(true);
    expect(isCommercialOfferLive(sampleOffer({ status: "accepted" }), now)).toBe(true);
    expect(isCommercialOfferLive(sampleOffer({ status: "draft" }), now)).toBe(false);
    expect(isCommercialOfferLive(sampleOffer({ status: "withdrawn" }), now)).toBe(false);
    expect(
      isCommercialOfferLive(sampleOffer({ validFrom: now + 60_000 }), now),
    ).toBe(false);
    expect(
      isCommercialOfferLive(sampleOffer({ validUntil: now - 1 }), now),
    ).toBe(false);
  });

  it("returns offer prices only for allowed cycles", () => {
    const offer = sampleOffer({
      monthlyPrice: 250,
      yearlyPrice: 2500,
      allowedCycles: ["yearly"],
    });
    expect(offerPriceForCycle(offer, "yearly")).toBe(2500);
    expect(offerPriceForCycle(offer, "monthly")).toBeNull();
    expect(offerPriceForCycle(offer, "lifetime")).toBeNull();
  });

  it("applies an offer only when base plan and cycle match", () => {
    const offer = sampleOffer();
    expect(offerAppliesToCheckout(offer, "pro", "monthly")).toBe(true);
    expect(offerAppliesToCheckout(offer, "basic", "monthly")).toBe(false);
    expect(offerAppliesToCheckout(offer, "pro", "lifetime")).toBe(false);
  });

  it("strips internal notes and gateway codes from the tenant projection", () => {
    const offer = sampleOffer({
      notesInternal: "secret margin note",
      gatewayMonthlyPlanCode: "PLN_secret",
      customerMessage: "Your negotiated Pro rate",
    });
    const tenant = toTenantCommercialOffer(offer);
    expect(tenant.customerMessage).toBe("Your negotiated Pro rate");
    expect(tenant).not.toHaveProperty("notesInternal");
    expect(tenant).not.toHaveProperty("gatewayMonthlyPlanCode");
    expect(tenant.monthlyPrice).toBe(300);
  });
});
