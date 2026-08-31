import { describe, expect, it } from "vitest";
import { alignDirectionToReason, alignReasonToDirection } from "@/features/inventory/stock-adjust";

describe("stock adjust direction", () => {
  it("keeps receive/return on add and maps damage off add", () => {
    expect(alignReasonToDirection("add", "damage")).toBe("receive");
    expect(alignReasonToDirection("add", "return")).toBe("return");
    expect(alignReasonToDirection("remove", "receive")).toBe("damage");
    expect(alignReasonToDirection("remove", "adjustment")).toBe("adjustment");
  });

  it("forces direction from reason when the reason implies a sign", () => {
    expect(alignDirectionToReason("damage", "add")).toBe("remove");
    expect(alignDirectionToReason("receive", "remove")).toBe("add");
    expect(alignDirectionToReason("adjustment", "remove")).toBe("remove");
  });
});
