import { describe, expect, it } from "vitest";
import { parseSellUnitsCell, serializeSellUnits } from "@/lib/import/sell-units-codec";

describe("sell-units-codec", () => {
  it("round-trips pack units for export → import", () => {
    const units = [
      {
        key: "pack",
        label: "Pack",
        factorToBase: 12,
        barcode: "PACK-12",
        sellingPrice: 48,
        active: true,
      },
      {
        key: "carton",
        label: "Carton",
        factorToBase: 24,
        sellingPrice: 90,
        active: true,
      },
    ];
    const cell = serializeSellUnits(units);
    expect(cell).toContain('"factorToBase":12');
    const parsed = parseSellUnitsCell(cell);
    expect(parsed).toEqual(units);
  });

  it("treats empty cells as leave-existing", () => {
    expect(parseSellUnitsCell("")).toBeNull();
    expect(parseSellUnitsCell("   ")).toBeNull();
  });

  it("rejects invalid JSON", () => {
    expect(() => parseSellUnitsCell("not-json")).toThrow(/JSON array/);
  });
});
