import { describe, expect, it } from "vitest";
import { deactivateAccountBlockReason } from "@/convex/shared/accountStatus";

describe("deactivateAccountBlockReason", () => {
  it("blocks deactivating your own account", () => {
    expect(
      deactivateAccountBlockReason({
        actorUserId: "user_1",
        targetUserId: "user_1",
        ownerUserId: "owner_1",
        presence: "offline",
      }),
    ).toMatch(/own account/i);
  });

  it("blocks deactivating the organization owner", () => {
    expect(
      deactivateAccountBlockReason({
        actorUserId: "admin_1",
        targetUserId: "owner_1",
        ownerUserId: "owner_1",
        presence: "offline",
      }),
    ).toMatch(/owner/i);
  });

  it("blocks deactivating a signed-in user", () => {
    expect(
      deactivateAccountBlockReason({
        actorUserId: "admin_1",
        targetUserId: "cashier_1",
        ownerUserId: "owner_1",
        presence: "online",
      }),
    ).toMatch(/signed in/i);
  });

  it("allows deactivating another offline staff account", () => {
    expect(
      deactivateAccountBlockReason({
        actorUserId: "admin_1",
        targetUserId: "cashier_1",
        ownerUserId: "owner_1",
        presence: "offline",
      }),
    ).toBeNull();
  });
});
