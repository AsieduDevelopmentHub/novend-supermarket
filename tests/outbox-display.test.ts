import { describe, expect, it } from "vitest";
import { isDisplayedConflict, isOutboxAuthWait, shouldReopenFailedOutboxWait } from "@/lib/offline/outbox-display";
import type { OutboxRow } from "@/lib/offline/types";

function row(partial: Partial<OutboxRow> & Pick<OutboxRow, "status" | "lastError">): OutboxRow {
  return {
    id: "ob_1",
    type: "complete_sale",
    payloadJson: "{}",
    clientOperationId: "op_1",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    attempts: partial.attempts ?? 4,
    status: partial.status,
    lastError: partial.lastError ?? undefined,
  };
}

describe("outbox display classification", () => {
  it("keeps auth waits out of Conflicts even when status is failed", () => {
    const authFailed = row({
      status: "failed",
      lastError: "Sign in online to upload queued changes from this device.",
      attempts: 4,
    });
    expect(isOutboxAuthWait(authFailed)).toBe(true);
    expect(isDisplayedConflict(authFailed)).toBe(false);
  });

  it("does not treat bare Sync failed as an auth wait", () => {
    const syncFailed = row({ status: "failed", lastError: "Sync failed", attempts: 3 });
    expect(isOutboxAuthWait(syncFailed)).toBe(false);
  });

  it("keeps Sync failed / Upload interrupted out of Conflicts", () => {
    const syncFailed = row({ status: "failed", lastError: "Sync failed", attempts: 21 });
    expect(isDisplayedConflict(syncFailed)).toBe(false);
  });

  it("keeps dependency waits out of Conflicts", () => {
    const wait = row({
      status: "failed",
      lastError: "Waiting for the category to finish syncing.",
      attempts: 2,
    });
    expect(isDisplayedConflict(wait)).toBe(false);
  });

  it("still surfaces stock and permission rejections as Conflicts", () => {
    const stock = row({
      status: "failed",
      lastError: "Insufficient stock for product X",
      attempts: 3,
    });
    expect(isDisplayedConflict(stock)).toBe(true);

    const blocked = row({
      status: "blocked_by_entitlement",
      lastError: "Feature not enabled",
      attempts: 1,
    });
    expect(isDisplayedConflict(blocked)).toBe(true);
  });

  it("reopens failed auth, dependency, and Sync failed placeholders on drain", () => {
    expect(shouldReopenFailedOutboxWait("Not authenticated")).toBe(true);
    expect(shouldReopenFailedOutboxWait("Waiting for the customer to finish syncing.")).toBe(true);
    expect(shouldReopenFailedOutboxWait("Sync failed")).toBe(true);
    expect(shouldReopenFailedOutboxWait("Insufficient stock")).toBe(true);
    expect(
      shouldReopenFailedOutboxWait(
        "Not enough stock for Mahama Ibrahim. Available: 0. Another till sold these units before this sale uploaded.",
      ),
    ).toBe(true);
  });
});
