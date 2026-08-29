import { describe, expect, it } from "vitest";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  isPasswordResetExpired,
  passwordResetRejectReason,
} from "@/convex/shared/passwordResetCrypto";

describe("password reset tokens", () => {
  it("hashes tokens so the raw secret is not stored", async () => {
    const token = createPasswordResetToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const hash = await hashPasswordResetToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
    expect(await hashPasswordResetToken(token)).toBe(hash);
  });

  it("rejects expired and reused tokens", () => {
    expect(isPasswordResetExpired(Date.now() - 1)).toBe(true);
    expect(isPasswordResetExpired(Date.now() + 60_000)).toBe(false);
    expect(passwordResetRejectReason({ expiresAt: Date.now() + 60_000 })).toBeNull();
    expect(passwordResetRejectReason({ expiresAt: Date.now() + 60_000, usedAt: Date.now() })).toBe(
      "used",
    );
    expect(passwordResetRejectReason({ expiresAt: Date.now() - 1 })).toBe("expired");
  });
});
