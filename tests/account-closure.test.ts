import { describe, expect, it } from "vitest";
import {
  ACCOUNT_CLOSURE_GRACE_DAYS,
  ACCOUNT_CLOSURE_GRACE_MS,
  hasPendingOrganizationClosure,
  isOrganizationOwner,
  normalizeRestorableStatus,
} from "../convex/shared/accountClosure";

describe("accountClosure helpers", () => {
  it("defines a 30-day grace window", () => {
    expect(ACCOUNT_CLOSURE_GRACE_DAYS).toBe(30);
    expect(ACCOUNT_CLOSURE_GRACE_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("detects organization owners", () => {
    const ownerId = "user_owner" as never;
    expect(isOrganizationOwner({ ownerUserId: ownerId }, ownerId)).toBe(true);
    expect(isOrganizationOwner({ ownerUserId: ownerId }, "user_other" as never)).toBe(false);
  });

  it("detects pending closure within the grace window", () => {
    const now = 1_000_000;
    expect(hasPendingOrganizationClosure({ closureEffectiveAt: now + 1 }, now)).toBe(true);
    expect(hasPendingOrganizationClosure({ closureEffectiveAt: now - 1 }, now)).toBe(false);
    expect(hasPendingOrganizationClosure({}, now)).toBe(false);
  });

  it("restores safe organization statuses after cancellation", () => {
    expect(normalizeRestorableStatus("trial")).toBe("trial");
    expect(normalizeRestorableStatus("suspended")).toBe("suspended");
    expect(normalizeRestorableStatus("disabled")).toBe("active");
    expect(normalizeRestorableStatus(undefined)).toBe("active");
  });
});
