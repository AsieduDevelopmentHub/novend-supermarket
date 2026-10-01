import { describe, expect, it } from "vitest";
import {
  SALE_CLIENT_FUTURE_SKEW_MS,
  SALE_CLIENT_MAX_AGE_MS,
  resolveSaleCompletedAt,
} from "@/convex/shared/saleTimestamps";

describe("resolveSaleCompletedAt", () => {
  const serverNow = Date.UTC(2026, 9, 1, 12, 0, 0);

  it("uses server now when the client stamp is missing", () => {
    expect(resolveSaleCompletedAt(undefined, serverNow)).toEqual({
      completedAt: serverNow,
      usedClientStamp: false,
    });
  });

  it("preserves a till stamp within the allowed window", () => {
    const client = serverNow - 60_000;
    expect(resolveSaleCompletedAt(client, serverNow)).toEqual({
      completedAt: client,
      usedClientStamp: true,
    });
  });

  it("rejects stamps too far in the future", () => {
    expect(() =>
      resolveSaleCompletedAt(serverNow + SALE_CLIENT_FUTURE_SKEW_MS + 1, serverNow),
    ).toThrow(/too far in the future/i);
  });

  it("rejects stamps older than the max age", () => {
    expect(() =>
      resolveSaleCompletedAt(serverNow - SALE_CLIENT_MAX_AGE_MS - 1, serverNow),
    ).toThrow(/too old/i);
  });

  it("rejects non-finite client stamps", () => {
    expect(() => resolveSaleCompletedAt(Number.NaN, serverNow)).toThrow(/invalid/i);
  });
});
