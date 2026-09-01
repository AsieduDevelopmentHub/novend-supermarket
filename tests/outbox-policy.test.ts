import { describe, expect, it } from "vitest";
import {
  isDefinitiveBusinessConflict,
  MAX_OUTBOX_UPLOAD_ATTEMPTS,
  shouldMarkOutboxFailed,
} from "@/lib/offline/outbox-policy";

describe("outbox retry policy", () => {
  it("fails definitive business conflicts immediately", () => {
    expect(shouldMarkOutboxFailed(1, "Insufficient stock for this sale")).toBe(true);
    expect(isDefinitiveBusinessConflict("SKU already exists")).toBe(true);
    expect(
      isDefinitiveBusinessConflict(
        "This business is suspended. You can review existing records, but new activity is paused.",
      ),
    ).toBe(true);
  });

  it("retries ambiguous business errors before failing", () => {
    expect(shouldMarkOutboxFailed(1, "Something went wrong")).toBe(false);
    expect(shouldMarkOutboxFailed(2, "Something went wrong")).toBe(false);
    expect(shouldMarkOutboxFailed(MAX_OUTBOX_UPLOAD_ATTEMPTS, "Something went wrong")).toBe(true);
  });

  it("never fails dependency waits", () => {
    expect(shouldMarkOutboxFailed(99, "Waiting for the category to finish syncing.")).toBe(false);
  });
});
