import { describe, expect, it } from "vitest";
import { mapReturnLinesToServerSaleItems } from "@/lib/offline/returns-repository";

describe("mapReturnLinesToServerSaleItems", () => {
  const localItems = [
    { id: "litem_a", productId: "prod_rice", quantity: 4 },
    { id: "litem_b", productId: "prod_oil", quantity: 1 },
    { id: "litem_c", productId: "prod_rice", quantity: 2 },
  ];
  const serverItems = [
    { id: "sitem_a", productId: "prod_rice", quantity: 4 },
    { id: "sitem_b", productId: "prod_oil", quantity: 1 },
    { id: "sitem_c", productId: "prod_rice", quantity: 2 },
  ];

  it("maps a device sale line onto the matching server line", () => {
    const mapped = mapReturnLinesToServerSaleItems(
      [
        {
          saleItemId: "litem_c",
          quantity: 1,
          productId: "prod_rice",
          soldQuantity: 2,
        },
      ],
      localItems,
      serverItems,
    );
    expect(mapped).toEqual([{ saleItemId: "sitem_c", quantity: 1 }]);
  });

  it("uses the local sale item when the outbox line has no product id", () => {
    const mapped = mapReturnLinesToServerSaleItems(
      [{ saleItemId: "litem_b", quantity: 1 }],
      localItems,
      serverItems,
    );
    expect(mapped).toEqual([{ saleItemId: "sitem_b", quantity: 1 }]);
  });

  it("returns null when a line cannot be matched", () => {
    expect(
      mapReturnLinesToServerSaleItems(
        [{ saleItemId: "missing", quantity: 1, productId: "prod_gone", soldQuantity: 1 }],
        localItems,
        serverItems,
      ),
    ).toBeNull();
  });
});
