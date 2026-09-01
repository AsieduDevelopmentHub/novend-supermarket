import { describe, expect, it } from "vitest";
import { cartDraftStorageKey, parseCartDraft, type CartDraft } from "@/lib/sales/cart-draft";

const sample: CartDraft = {
  userId: "user_1",
  branchId: "branch_1",
  items: [{ productId: "prod_1", name: "Water", unitPrice: 2, quantity: 3, discount: 0 }],
  discountMode: "percent",
  discountField: 10,
  customer: { id: "cust_1", name: "Ama", phone: "0240000000" },
  savedAt: 1_700_000_000_000,
};

describe("cart draft", () => {
  it("keys drafts by cashier and branch", () => {
    expect(cartDraftStorageKey("user_1", "branch_1")).toBe("novend.cartDraft:user_1:branch_1");
    expect(cartDraftStorageKey("user_1", null)).toBe("novend.cartDraft:user_1:_");
  });

  it("restores a valid draft for the same cashier and branch", () => {
    const restored = parseCartDraft(JSON.stringify(sample), "user_1", "branch_1");
    expect(restored?.items).toEqual(sample.items);
    expect(restored?.discountMode).toBe("percent");
    expect(restored?.customer?.name).toBe("Ama");
  });

  it("rejects drafts from another cashier, branch, or corrupt payload", () => {
    expect(parseCartDraft(JSON.stringify(sample), "user_2", "branch_1")).toBeNull();
    expect(parseCartDraft(JSON.stringify(sample), "user_1", "branch_2")).toBeNull();
    expect(parseCartDraft("{", "user_1", "branch_1")).toBeNull();
    expect(
      parseCartDraft(JSON.stringify({ ...sample, items: [{ name: "bad" }] }), "user_1", "branch_1"),
    ).toBeNull();
  });

  it("treats an empty payload as no draft", () => {
    expect(parseCartDraft(null, "user_1", "branch_1")).toBeNull();
  });
});
