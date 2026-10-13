import { describe, expect, it } from "vitest";
import {
  evaluateSplitTender,
  newSplitDraft,
  type SplitTenderDraft,
} from "@/lib/sales/split-tender";

const draft = (
  method: SplitTenderDraft["method"],
  amount: string,
  id: string = method,
): SplitTenderDraft => ({ id, method, amount });

describe("evaluateSplitTender", () => {
  it("is valid when the lines cover the total exactly", () => {
    const result = evaluateSplitTender([draft("cash", "60"), draft("mobile_money", "40")], 100, {
      allowOnAccount: false,
    });
    expect(result.valid).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.payments).toEqual([
      { method: "cash", amount: 60 },
      { method: "mobile_money", amount: 40 },
    ]);
  });

  it("reports what is left to collect while the cashier is still typing", () => {
    const result = evaluateSplitTender([draft("cash", "60"), draft("card", "")], 100, {
      allowOnAccount: false,
    });
    expect(result.valid).toBe(false);
    expect(result.remaining).toBe(40);
    expect(result.error).toMatch(/do not cover/i);
  });

  it("flags over-allocation", () => {
    const result = evaluateSplitTender([draft("cash", "80"), draft("card", "40")], 100, {
      allowOnAccount: false,
    });
    expect(result.valid).toBe(false);
    expect(result.remaining).toBe(-20);
    expect(result.error).toMatch(/exceed/i);
  });

  it("requires an amount and ignores blank, zero and invalid rows", () => {
    expect(
      evaluateSplitTender([draft("cash", ""), draft("card", "0")], 100, { allowOnAccount: false })
        .error,
    ).toMatch(/enter an amount/i);
    expect(
      evaluateSplitTender([draft("cash", "abc"), draft("card", "100")], 100, {
        allowOnAccount: false,
      }).valid,
    ).toBe(true);
  });

  it("only allows on account when a customer with credit is selected", () => {
    const drafts = [draft("cash", "20"), draft("on_account", "80")];
    expect(evaluateSplitTender(drafts, 100, { allowOnAccount: false })).toMatchObject({
      valid: false,
      error: expect.stringMatching(/choose a customer/i),
    });
    expect(evaluateSplitTender(drafts, 100, { allowOnAccount: true }).valid).toBe(true);
  });

  it("merges repeated methods through the shared normalizer", () => {
    const result = evaluateSplitTender(
      [draft("cash", "30", "a"), draft("cash", "20", "b"), draft("card", "50", "c")],
      100,
      { allowOnAccount: false },
    );
    expect(result.payments).toEqual([
      { method: "cash", amount: 50 },
      { method: "card", amount: 50 },
    ]);
  });

  it("handles cent amounts without float drift", () => {
    const result = evaluateSplitTender([draft("cash", "33.33"), draft("card", "66.67")], 100, {
      allowOnAccount: false,
    });
    expect(result.valid).toBe(true);
  });
});

describe("newSplitDraft", () => {
  it("formats a prefilled amount and leaves it blank otherwise", () => {
    expect(newSplitDraft("a", "cash", 12.5).amount).toBe("12.50");
    expect(newSplitDraft("a", "cash", null).amount).toBe("");
    expect(newSplitDraft("a", "cash", 0).amount).toBe("");
  });
});
