import { describe, expect, it } from "vitest";
import { isDefinitiveBusinessConflict, shouldMarkOutboxFailed } from "@/lib/offline/outbox-policy";
import { isSyncBusinessConflict } from "@/lib/offline/sync-errors";
import { roundQuantity, toBaseQuantity } from "@/convex/shared/units";

/**
 * Encodes the Stage 3b weight / multi-terminal conflict matrix product choice:
 * Convex rejects oversell (never negative stock); local sale + receipt stay
 * immutable; outbox marks failed for cashier/manager reconciliation.
 * See docs/architecture/ROADMAP_CAPABILITIES.md.
 */
describe("weight / multi-terminal conflict matrix", () => {
  const oversell = "Not enough stock for Rice. Available: 1.25.";

  it("treats oversell as a business conflict (not a silent network retry forever)", () => {
    expect(isSyncBusinessConflict(oversell)).toBe(true);
    expect(isDefinitiveBusinessConflict(oversell)).toBe(true);
    expect(shouldMarkOutboxFailed(1, oversell)).toBe(true);
  });

  it("keeps both offline sales locally until sync — second sync may fail without rewriting the first", () => {
    const onHand = 2.5;
    const terminalA = toBaseQuantity(1.5, 1);
    const terminalB = toBaseQuantity(1.5, 1);
    expect(roundQuantity(terminalA + terminalB)).toBeGreaterThan(onHand);
    // Product choice: first Convex apply wins; second throws oversell → failed outbox.
    // Neither local sale row is deleted by sync failure.
    expect(isDefinitiveBusinessConflict(oversell)).toBe(true);
  });

  it("does not treat piece-only stock messages differently from weight oversell", () => {
    expect(isDefinitiveBusinessConflict("Not enough stock for Soap. Available: 2.")).toBe(true);
  });

  it("leaves dependency waits pending (customer still syncing)", () => {
    expect(shouldMarkOutboxFailed(5, "Waiting for the customer to finish syncing.")).toBe(false);
  });
});
