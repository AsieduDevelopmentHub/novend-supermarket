import { describe, expect, it } from "vitest";
import { isStaleFailedOutboxRow, STALE_FAILED_OUTBOX_MS } from "@/lib/offline/outbox-actions";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { OutboxRow } from "@/lib/offline/types";

function sampleRow(overrides: Partial<OutboxRow>): OutboxRow {
  return {
    id: "o1",
    type: "adjust_stock",
    status: "failed",
    payloadJson: "{}",
    attempts: 3,
    lastError: "Insufficient stock",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    clientOperationId: "c1",
    ...overrides,
  };
}

describe("stale failed outbox clear", () => {
  it("treats week-old failed rows as stale", () => {
    const now = Date.now();
    expect(
      isStaleFailedOutboxRow(
        sampleRow({ createdAt: now - STALE_FAILED_OUTBOX_MS - 1_000 }),
        STALE_FAILED_OUTBOX_MS,
        now,
      ),
    ).toBe(true);
    expect(
      isStaleFailedOutboxRow(
        sampleRow({ createdAt: now - 60_000 }),
        STALE_FAILED_OUTBOX_MS,
        now,
      ),
    ).toBe(false);
    expect(
      isStaleFailedOutboxRow(
        sampleRow({ status: "pending", createdAt: now - STALE_FAILED_OUTBOX_MS * 2 }),
        STALE_FAILED_OUTBOX_MS,
        now,
      ),
    ).toBe(false);
  });

  it("wires Sync Center clear-old and auto-drain for stale failures", () => {
    const dialog = readFileSync(
      resolve(process.cwd(), "components/offline/sync-center-dialog.tsx"),
      "utf8",
    );
    const engine = readFileSync(resolve(process.cwd(), "lib/offline/sync-engine.ts"), "utf8");
    expect(dialog).toContain("Clear old problems");
    expect(dialog).toContain("discardStaleFailedOutboxEvents");
    expect(engine).toContain("discardStaleFailedOutboxEvents");
  });
});
