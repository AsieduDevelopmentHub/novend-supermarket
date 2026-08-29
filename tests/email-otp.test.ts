import { describe, expect, it } from "vitest";
import {
  canResendEmailOtp,
  createEmailOtpCode,
  emailOtpRejectReason,
  hashEmailOtp,
  isEmailOtpExpired,
  isEmailVerifiedRecord,
  isWellFormedEmail,
  maskEmail,
  readAuthoritativeEmailVerified,
  shouldShowEmailVerificationReminder,
  tooManySends,
} from "@/convex/shared/emailOtp";

describe("email OTP", () => {
  it("generates a 6-digit code", () => {
    const code = createEmailOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("hashes codes so the raw OTP is not stored", async () => {
    const hash = await hashEmailOtp("user_1", "owner@shop.com", "123456");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("123456");
    expect(await hashEmailOtp("user_1", "owner@shop.com", "123456")).toBe(hash);
    expect(await hashEmailOtp("user_1", "owner@shop.com", "654321")).not.toBe(hash);
    expect(await hashEmailOtp("user_2", "owner@shop.com", "123456")).not.toBe(hash);
  });

  it("rejects expired, used, and locked codes", () => {
    const future = Date.now() + 60_000;
    expect(emailOtpRejectReason({ expiresAt: future, attemptCount: 0 })).toBeNull();
    expect(emailOtpRejectReason({ expiresAt: future, attemptCount: 0, usedAt: Date.now() })).toBe(
      "used",
    );
    expect(isEmailOtpExpired(Date.now() - 1)).toBe(true);
    expect(emailOtpRejectReason({ expiresAt: Date.now() - 1, attemptCount: 0 })).toBe("expired");
    expect(emailOtpRejectReason({ expiresAt: future, attemptCount: 5 })).toBe("locked");
  });

  it("does not accept a reused OTP after usedAt is set", () => {
    expect(
      emailOtpRejectReason({
        expiresAt: Date.now() + 60_000,
        attemptCount: 1,
        usedAt: Date.now(),
      }),
    ).toBe("used");
  });

  it("rate-limits resend and hourly volume", () => {
    const now = 1_000_000;
    expect(canResendEmailOtp(undefined, now)).toBe(true);
    expect(canResendEmailOtp(now - 10_000, now)).toBe(false);
    expect(canResendEmailOtp(now - 61_000, now)).toBe(true);
    expect(tooManySends(Array.from({ length: 8 }, () => now - 1000), now)).toBe(true);
    expect(tooManySends(Array.from({ length: 7 }, () => now - 1000), now)).toBe(false);
  });

  it("masks the mailbox and validates email shape", () => {
    expect(maskEmail("ama.mensah@shop.com")).toBe("a••••••@shop.com");
    expect(isWellFormedEmail("ama@shop.com")).toBe(true);
    expect(isWellFormedEmail("not-an-email")).toBe(false);
  });

  it("treats verification as bound to the current email", () => {
    expect(isEmailVerifiedRecord({ email: "a@shop.com", verifiedAt: 1 }, "a@shop.com")).toBe(true);
    expect(isEmailVerifiedRecord({ email: "a@shop.com", verifiedAt: 1 }, "b@shop.com")).toBe(false);
    expect(isEmailVerifiedRecord(null, "a@shop.com")).toBe(false);
  });

  it("ignores a client-side verified flag", () => {
    expect(readAuthoritativeEmailVerified({ emailVerified: true })).toBe(true);
    expect(readAuthoritativeEmailVerified({ emailVerified: false })).toBe(false);
    const forged = { emailVerified: true as boolean };
    forged.emailVerified = true;
    expect(readAuthoritativeEmailVerified({ emailVerified: false })).toBe(false);
  });

  it("does not nag offline authenticated sessions", () => {
    expect(
      shouldShowEmailVerificationReminder({
        online: false,
        emailVerified: false,
        dismissed: false,
      }),
    ).toBe(false);
    expect(
      shouldShowEmailVerificationReminder({
        online: true,
        emailVerified: false,
        dismissed: false,
      }),
    ).toBe(true);
    expect(
      shouldShowEmailVerificationReminder({
        online: true,
        emailVerified: true,
        dismissed: false,
      }),
    ).toBe(false);
  });
});
