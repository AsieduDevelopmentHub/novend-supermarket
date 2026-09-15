import { describe, expect, it } from "vitest";
import {
  buildSaleLineUnitSnapshot,
  listActiveSellUnits,
  resolveSellUnit,
  roundQuantity,
  synthesizeDefaultSellUnit,
  toBaseQuantity,
} from "@/convex/shared/units";

describe("units conversion", () => {
  const product = {
    unit: "bottle",
    sellingPrice: 5,
    costPrice: 3,
    sellUnits: [
      { key: "bottle", label: "Bottle", factorToBase: 1, sellingPrice: 5, active: true },
      { key: "pack", label: "Pack of 6", factorToBase: 6, sellingPrice: 27, active: true },
      { key: "crate", label: "Crate of 24", factorToBase: 24, sellingPrice: 100, active: true },
    ],
  };

  it("synthesizes default unit from legacy fields", () => {
    const unit = synthesizeDefaultSellUnit({
      unit: "pcs",
      sellingPrice: 10,
      costPrice: 4,
    });
    expect(unit.key).toBe("default");
    expect(unit.factorToBase).toBe(1);
    expect(unit.unitPrice).toBe(10);
  });

  it("converts pack qty to base bottles", () => {
    expect(toBaseQuantity(2, 24)).toBe(48);
    const unit = resolveSellUnit(product, "crate");
    const snap = buildSaleLineUnitSnapshot(unit, 2);
    expect(snap.baseQuantity).toBe(48);
    expect(snap.displayedQuantity).toBe(2);
    expect(snap.sellUnitLabel).toBe("Crate of 24");
  });

  it("supports fractional weight quantities", () => {
    const weightProduct = {
      unit: "kg",
      sellingPrice: 65,
      costPrice: 40,
      pricingMode: "per_weight" as const,
      sellUnits: [{ key: "kg", label: "kg", factorToBase: 1, sellingPrice: 65, active: true }],
    };
    const unit = resolveSellUnit(weightProduct, "kg");
    const snap = buildSaleLineUnitSnapshot(unit, roundQuantity(2.35));
    expect(snap.baseQuantity).toBe(2.35);
    expect(listActiveSellUnits(weightProduct)).toHaveLength(1);
  });
});
