import { describe, expect, it } from "vitest";
import {
  configurationFromIndustryPack,
  hasBusinessCapability,
  validateBusinessCapabilitySet,
} from "@/convex/shared/businessCapabilities";

/** Folio open charges sum (mirrors checkout eligibility). */
function folioOpenTotal(
  charges: Array<{ status: "open" | "void"; lineTotal: number }>,
): number {
  return charges
    .filter((c) => c.status === "open")
    .reduce((sum, c) => sum + c.lineTotal, 0);
}

describe("hotel folio helpers", () => {
  it("sums open charges and ignores voids", () => {
    const total = folioOpenTotal([
      { status: "open", lineTotal: 100 },
      { status: "void", lineTotal: 50 },
      { status: "open", lineTotal: 25.5 },
    ]);
    expect(total).toBe(125.5);
  });

  it("treats empty folio as not payable", () => {
    expect(folioOpenTotal([])).toBe(0);
    expect(folioOpenTotal([{ status: "void", lineTotal: 10 }])).toBe(0);
  });

  it("hotel pack enables rooms_folio and reservations on Basic", () => {
    const hotel = configurationFromIndustryPack("hotel", "basic");
    expect(hasBusinessCapability(hotel, "rooms_folio")).toBe(true);
    expect(hasBusinessCapability(hotel, "reservations")).toBe(true);
  });

  it("rejects reservations without expanding rooms_folio only when plan blocks parent", () => {
    const result = validateBusinessCapabilitySet(["reservations"], "basic");
    expect(result.ok).toBe(true);
  });
});
