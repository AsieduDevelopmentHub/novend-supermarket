import { describe, expect, it } from "vitest";
import { attachSoldLineSnapshots, withReceiptQuantities } from "@/lib/offline/sale-upload-lines";
import type { LocalSaleItem } from "@/lib/offline/types";

function savedLine(overrides: Partial<LocalSaleItem> = {}): LocalSaleItem {
  return {
    id: "litem_1",
    localSaleId: "lsale_1",
    productId: "prod_1",
    productName: "Rice",
    sku: "RICE",
    quantity: 12,
    unitPrice: 40,
    unitCost: 20,
    discount: 5,
    lineTotal: 35,
    sellUnitKey: "carton",
    sellUnitLabel: "Carton",
    displayedQuantity: 1,
    factorToBase: 12,
    pricingMode: "fixed",
    ...overrides,
  };
}

describe("attachSoldLineSnapshots", () => {
  it("fills price and base quantity from the receipt line", () => {
    const [line] = attachSoldLineSnapshots(
      [{ productId: "prod_1", quantity: 1, discount: 5, sellUnitKey: "carton" }],
      [savedLine()],
    );
    expect(line?.unitPrice).toBe(40);
    expect(line?.baseQuantity).toBe(12);
    expect(line?.factorToBase).toBe(12);
    expect(line?.sellUnitLabel).toBe("Carton");
  });

  it("leaves a line that already has a snapshot", () => {
    const [line] = attachSoldLineSnapshots(
      [
        {
          productId: "prod_1",
          quantity: 1,
          discount: 5,
          unitPrice: 40,
          baseQuantity: 12,
        },
      ],
      [savedLine({ unitPrice: 99, quantity: 99 })],
    );
    expect(line?.unitPrice).toBe(40);
    expect(line?.baseQuantity).toBe(12);
  });

  it("does not reuse one receipt line for two cart rows", () => {
    const lines = attachSoldLineSnapshots(
      [
        { productId: "prod_1", quantity: 1, discount: 5 },
        { productId: "prod_1", quantity: 1, discount: 0 },
      ],
      [savedLine(), savedLine({ id: "litem_2", discount: 0, unitPrice: 40 })],
    );
    expect(lines[0]?.unitPrice).toBe(40);
    expect(lines[1]?.discount).toBe(0);
    expect(lines[0]?.baseQuantity).toBe(12);
    expect(lines[1]?.baseQuantity).toBe(12);
  });

  it("puts the receipt base quantity on an older sale payload", async () => {
    const [row] = await withReceiptQuantities(
      [
        {
          type: "complete_sale",
          payloadJson: JSON.stringify({
            localSaleId: "lsale_1",
            branchId: "br_1",
            items: [{ productId: "prod_1", quantity: 1, discount: 5 }],
          }),
        },
      ],
      async () => [savedLine()],
    );
    const payload = JSON.parse(row?.payloadJson ?? "{}") as {
      items: Array<{ baseQuantity?: number }>;
    };
    expect(payload.items[0]?.baseQuantity).toBe(12);
  });
});
