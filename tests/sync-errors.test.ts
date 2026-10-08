import { describe, expect, it } from "vitest";
import { isOpaqueServerDump, isSyncBusinessConflict } from "@/lib/offline/sync-errors";

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

  it("leaves auth and Sync failed placeholders as transient", () => {
    expect(isSyncBusinessConflict("Not authenticated")).toBe(false);
    expect(isSyncBusinessConflict("Unauthenticated")).toBe(false);
    expect(isSyncBusinessConflict("Sync failed")).toBe(false);
    expect(isSyncBusinessConflict("Upload timed out")).toBe(false);
  });

  it("stops the queue only when the device cannot reach the server", async () => {
    const { transientFailureStopsDrain } = await import("@/lib/offline/sync-errors");
    expect(transientFailureStopsDrain("Failed to fetch")).toBe(true);
    expect(transientFailureStopsDrain("Sync failed")).toBe(false);
    expect(transientFailureStopsDrain("Upload timed out")).toBe(false);
  });

  it("leaves opaque Convex dumps as transient so drain can backoff", () => {
    const dump =
      "[CONVEX M(sales:completeSale)] [Request ID: abc] Server Error Uncaught Error at handler (../sales.ts:1:1)";
    expect(isOpaqueServerDump(dump)).toBe(true);
    expect(isSyncBusinessConflict(dump)).toBe(false);
  });

  it("leaves an optimistic concurrency failure as retryable", () => {
    expect(
      isSyncBusinessConflict(
        "Documents read from or written to the branchStock table changed while this mutation was being run",
      ),
    ).toBe(false);
  });

  it("does not treat bare Sync failed as an auth-required error", async () => {
    const { isAuthRequiredError } = await import("@/lib/offline/sync-errors");
    expect(isAuthRequiredError("Sync failed")).toBe(false);
    expect(isAuthRequiredError("Sign in online to continue")).toBe(true);
  });

  it("does not treat category/product wait messages as conflicts", () => {
    expect(isSyncBusinessConflict("Waiting for the category to finish syncing.")).toBe(false);
    expect(isSyncBusinessConflict("Waiting for the supplier or product to finish syncing.")).toBe(
      false,
    );
  });
});
