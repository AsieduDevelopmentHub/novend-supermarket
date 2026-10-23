import { describe, expect, it } from "vitest";
import { normalizeReceiptPayload } from "@/services/printing";
import { SAMPLE_RECEIPT_PAYLOAD } from "@/features/receipts/types";

describe("normalizeReceiptPayload tender lines", () => {
  it("keeps amount paid and change for preview and print", () => {
    const normalized = normalizeReceiptPayload({
      ...SAMPLE_RECEIPT_PAYLOAD,
      amountPaid: 100,
      changeGiven: 2,
    });
    expect(normalized.amountPaid).toBe(100);
    expect(normalized.changeGiven).toBe(2);
  });

  it("omits tender lines when amount paid was not recorded", () => {
    const { amountPaid: _a, changeGiven: _c, ...withoutTender } = SAMPLE_RECEIPT_PAYLOAD;
    const normalized = normalizeReceiptPayload(withoutTender);
    expect(normalized.amountPaid).toBeUndefined();
    expect(normalized.changeGiven).toBeUndefined();
  });
});
