import { describe, expect, it } from "vitest";
import {
  isSalePaymentMethod,
  normalizeSalePayments,
  onAccountAmount,
  primarySalePaymentMethod,
} from "@/convex/shared/salePayments";

describe("normalizeSalePayments", () => {
  it("falls back to one line in the chosen method when no split is given", () => {
    expect(normalizeSalePayments(undefined, "mobile_money", 120)).toEqual([
      { method: "mobile_money", amount: 120 },
    ]);
    expect(normalizeSalePayments([], "cash", 49.5)).toEqual([{ method: "cash", amount: 49.5 }]);
  });

  it("returns no lines for a zero-total sale", () => {
    expect(normalizeSalePayments(undefined, "cash", 0)).toEqual([]);
  });

  it("accepts a split that sums to the total and collapses duplicate methods", () => {
    const lines = normalizeSalePayments(
      [
        { method: "cash", amount: 40 },
        { method: "mobile_money", amount: 30 },
        { method: "cash", amount: 30 },
      ],
      "cash",
      100,
    );
    expect(lines).toEqual([
      { method: "cash", amount: 70 },
      { method: "mobile_money", amount: 30 },
    ]);
  });

  it("drops zero lines but rejects a split that does not cover the total", () => {
    expect(
      normalizeSalePayments(
        [
          { method: "cash", amount: 100 },
          { method: "card", amount: 0 },
        ],
        "cash",
        100,
      ),
    ).toEqual([{ method: "cash", amount: 100 }]);
    expect(() => normalizeSalePayments([{ method: "cash", amount: 60 }], "cash", 100)).toThrow(
      /must equal the sale total/,
    );
    expect(() =>
      normalizeSalePayments(
        [
          { method: "cash", amount: 60 },
          { method: "card", amount: 60 },
        ],
        "cash",
        100,
      ),
    ).toThrow(/must equal the sale total/);
  });

  it("tolerates cent rounding but not a real gap", () => {
    expect(
      normalizeSalePayments(
        [
          { method: "cash", amount: 33.33 },
          { method: "card", amount: 66.67 },
        ],
        "cash",
        100,
      ),
    ).toHaveLength(2);
    expect(() => normalizeSalePayments([{ method: "cash", amount: 99.98 }], "cash", 100)).toThrow();
  });

  it("rejects invalid methods and amounts from a hostile client", () => {
    expect(() =>
      normalizeSalePayments([{ method: "bitcoin" as never, amount: 10 }], "cash", 10),
    ).toThrow(/invalid payment method/i);
    expect(() => normalizeSalePayments([{ method: "cash", amount: -5 }], "cash", 10)).toThrow(
      /invalid payment amount/i,
    );
    expect(() =>
      normalizeSalePayments([{ method: "cash", amount: Number.NaN }], "cash", 10),
    ).toThrow(/invalid payment amount/i);
    expect(() => normalizeSalePayments([{ method: "cash", amount: 0 }], "cash", 10)).toThrow(
      /at least one payment/i,
    );
  });

  it("supports on account as a tender", () => {
    const lines = normalizeSalePayments(
      [
        { method: "cash", amount: 25 },
        { method: "on_account", amount: 75 },
      ],
      "cash",
      100,
    );
    expect(onAccountAmount(lines)).toBe(75);
    expect(isSalePaymentMethod("on_account")).toBe(true);
    expect(isSalePaymentMethod("cheque")).toBe(false);
  });
});

describe("primarySalePaymentMethod", () => {
  it("picks the largest tender and the first on a tie", () => {
    expect(
      primarySalePaymentMethod([
        { method: "cash", amount: 30 },
        { method: "card", amount: 70 },
      ]),
    ).toBe("card");
    expect(
      primarySalePaymentMethod([
        { method: "mobile_money", amount: 50 },
        { method: "cash", amount: 50 },
      ]),
    ).toBe("mobile_money");
    expect(primarySalePaymentMethod([])).toBe("cash");
  });
});
