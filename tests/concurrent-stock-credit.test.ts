import { describe, expect, it } from "vitest";
import { checkCreditLimit, customerBalance } from "@/convex/shared/customerCredit";
import { takeWholesaleLotsFefo } from "@/lib/offline/wholesale-lots";
import type { MirroredWholesaleLot } from "@/lib/offline/types";

/**
 * Pure-logic stand-ins for concurrent tills. Convex serialises mutations per document set,
 * so two checkouts behave as sequential applications of the same rule. These tests prove
 * the rule itself rejects the second request; they are not a load test against a deployment.
 */

interface StockState {
  onHand: number;
}

function sellFromStock(state: StockState, quantity: number): StockState {
  if (quantity <= 0) throw new Error("Invalid quantity");
  if (state.onHand < quantity) throw new Error("Insufficient stock");
  return { onHand: state.onHand - quantity };
}

describe("concurrent stock sales", () => {
  it("accepts sales until stock runs out and rejects the oversell", () => {
    let state: StockState = { onHand: 10 };
    const outcomes = [6, 6, 4].map((qty) => {
      try {
        state = sellFromStock(state, qty);
        return "ok";
      } catch (error) {
        return (error as Error).message;
      }
    });
    expect(outcomes).toEqual(["ok", "Insufficient stock", "ok"]);
    expect(state.onHand).toBe(0);
  });

  it("never lets stock go negative however many tills race", () => {
    let state: StockState = { onHand: 7 };
    let accepted = 0;
    for (let till = 0; till < 50; till += 1) {
      try {
        state = sellFromStock(state, 1);
        accepted += 1;
      } catch {
        // rejected: stock exhausted
      }
    }
    expect(accepted).toBe(7);
    expect(state.onHand).toBe(0);
  });

  it("rejects the second warehouse transfer that exceeds dated lots", () => {
    const lots: MirroredWholesaleLot[] = [
      {
        id: "a",
        productId: "p1",
        quantity: 10,
        expiryDate: "2027-01-01",
        receivedAt: 1,
        lotCode: "a",
      },
    ];
    const first = takeWholesaleLotsFefo(lots, "p1", 8);
    expect(() => takeWholesaleLotsFefo(first.lots, "p1", 8)).toThrow(
      /insufficient dated wholesale stock/i,
    );
  });
});

describe("concurrent on-account sales", () => {
  it("rejects a charge that would push the balance over the limit after an earlier one", () => {
    const ledger = [{ amount: 300 }];
    const limit = 500;
    const results = [150, 150, 40].map((charge) => {
      const check = checkCreditLimit({
        currentBalance: customerBalance(ledger),
        charge,
        limit,
      });
      if (check.ok) ledger.push({ amount: charge });
      return check.ok;
    });
    expect(results).toEqual([true, false, true]);
    expect(customerBalance(ledger)).toBe(490);
    expect(customerBalance(ledger)).toBeLessThanOrEqual(limit);
  });

  it("lets a payment free credit for a later charge", () => {
    const ledger = [{ amount: 500 }];
    expect(
      checkCreditLimit({ currentBalance: customerBalance(ledger), charge: 10, limit: 500 }).ok,
    ).toBe(false);
    ledger.push({ amount: -100 });
    expect(
      checkCreditLimit({ currentBalance: customerBalance(ledger), charge: 10, limit: 500 }).ok,
    ).toBe(true);
  });
});
