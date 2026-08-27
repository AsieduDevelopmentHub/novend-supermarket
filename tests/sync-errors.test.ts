import { describe, expect, it } from "vitest";
import { isSyncBusinessConflict } from "@/lib/offline/sync-errors";

describe("isSyncBusinessConflict", () => {
  it("treats stock and forbidden rejections as conflicts", () => {
    expect(isSyncBusinessConflict("Insufficient stock")).toBe(true);
    expect(isSyncBusinessConflict("Forbidden")).toBe(true);
    expect(isSyncBusinessConflict("SKU already exists")).toBe(true);
    expect(
      isSyncBusinessConflict("Expiry date is required when tracking expiry on initial stock"),
    ).toBe(true);
  });

  it("leaves network errors as transient", () => {
    expect(isSyncBusinessConflict("Failed to fetch")).toBe(false);
    expect(isSyncBusinessConflict("net::ERR_INTERNET_DISCONNECTED")).toBe(false);
  });
});
