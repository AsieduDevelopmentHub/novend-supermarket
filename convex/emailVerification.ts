import { getAuthUserId, retrieveAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  query,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { writeAuditLog } from "./shared/audit";
import { loadEmailVerification } from "./shared/emailVerificationLookup";
import { renderEmailOtpEmail } from "./shared/emailTemplates";
import { sendTransactionalEmail } from "./shared/transactionalEmail";
import {
  EMAIL_OTP_MAX_ATTEMPTS,
  EMAIL_OTP_RESEND_INTERVAL_MS,
  EMAIL_OTP_TTL_MS,
  canResendEmailOtp,
  createEmailOtpCode,
  emailOtpGenericError,
  emailOtpRejectReason,
  hashEmailOtp,
  isWellFormedEmail,
  maskEmail,
  normalizeEmail,
  resendWaitMs,
  tooManySends,
} from "./shared/emailOtp";

const WRONG_PASSWORD_ERROR = "Current password is incorrect.";
const EMAIL_TAKEN_ERROR = "That email is already registered to another account.";
const EMAIL_RATE_LIMIT_ERROR = "Too many attempts. Try again in a few minutes.";
const EMAIL_MISSING_ACCOUNT_ERROR = "This account cannot change email with a password.";
const EMAIL_SEND_ERROR = "We couldn't send a verification code. Try again in a moment.";

export const getState = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => loadEmailVerification(ctx, args.userId),
});

/** Password login id for the signed-in user (may differ in case from users.email). */
export const getPasswordAccount = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", args.userId).eq("provider", "password"))
      .unique();
    if (!account) return null;
    return { providerAccountId: account.providerAccountId as string };
  },
});

/** Unused challenge still open for OTP verify / resend targeting. */
export const getActiveChallenge = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const recent = await ctx.db
      .query("emailVerificationChallenges")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(5);
    const active = recent.find((row) => !row.usedAt && row.expiresAt > now);
    if (!active) return null;
    return { email: active.email, expiresAt: active.expiresAt };
  },
});

export const isEmailTaken = internalQuery({
  args: { userId: v.id("users"), email: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .unique();
    if (account && account.userId !== args.userId) return true;
    const byEmail = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (byEmail && byEmail._id !== args.userId) return true;
    return false;
  },
});

export const insertChallenge = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    const recent = await ctx.db
      .query("emailVerificationChallenges")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(12);
    if (!canResendEmailOtp(recent[0]?.createdAt, args.createdAt)) {
      return {
        ok: false as const,
        reason: "throttled" as const,
        retryAfterMs: resendWaitMs(recent[0]!.createdAt, args.createdAt),
      };
    }
    if (
      tooManySends(
        recent.map((row) => row.createdAt),
        args.createdAt,
      )
    ) {
      return { ok: false as const, reason: "limited" as const, retryAfterMs: EMAIL_OTP_TTL_MS };
    }
    for (const row of recent) {
      if (!row.usedAt) {
        await ctx.db.patch(row._id, { usedAt: args.createdAt });
      }
    }
    const challengeId = await ctx.db.insert("emailVerificationChallenges", {
      userId: args.userId,
      email: args.email,
      codeHash: args.codeHash,
      expiresAt: args.expiresAt,
      createdAt: args.createdAt,
      attemptCount: 0,
    });
    return { ok: true as const, retryAfterMs: EMAIL_OTP_RESEND_INTERVAL_MS, challengeId };
  },
});

export const discardUnusedChallenge = internalMutation({
  args: { challengeId: v.id("emailVerificationChallenges") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.challengeId);
    if (row && !row.usedAt) await ctx.db.delete(args.challengeId);
  },
});

export const consumeChallenge = internalMutation({
  args: { userId: v.id("users"), codeHash: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const recent = await ctx.db
      .query("emailVerificationChallenges")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(5);
    const active = recent.find((row) => !row.usedAt);
    if (!active) return { ok: false as const };
    const rejected = emailOtpRejectReason(active);
    if (rejected) {
      if (rejected !== "used") {
        await ctx.db.patch(active._id, { attemptCount: active.attemptCount + 1 });
      }
      return { ok: false as const };
    }
    if (active.codeHash !== args.codeHash) {
      const attemptCount = active.attemptCount + 1;
      await ctx.db.patch(active._id, {
        attemptCount,
        ...(attemptCount >= EMAIL_OTP_MAX_ATTEMPTS ? { usedAt: now } : {}),
      });
      return { ok: false as const };
    }

    const user = await ctx.db.get(args.userId);
    if (!user?.email) return { ok: false as const };
    const currentEmail = normalizeEmail(user.email);
    const challengeEmail = normalizeEmail(active.email);

    let passwordAccountId: Id<"authAccounts"> | null = null;
    if (currentEmail !== challengeEmail) {
      const takenAccount = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", challengeEmail),
        )
        .unique();
      if (takenAccount && takenAccount.userId !== args.userId) {
        return { ok: false as const, reason: "taken" as const };
      }
      const takenUser = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", challengeEmail))
        .unique();
      if (takenUser && takenUser._id !== args.userId) {
        return { ok: false as const, reason: "taken" as const };
      }
      const account = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", args.userId).eq("provider", "password"),
        )
        .unique();
      if (!account) return { ok: false as const, reason: "missing" as const };
      passwordAccountId = account._id;
    }

    await ctx.db.patch(active._id, { usedAt: now });

    if (passwordAccountId) {
      await ctx.db.patch(args.userId, { email: challengeEmail });
      await ctx.db.patch(passwordAccountId, { providerAccountId: challengeEmail });
      await writeAuditLog(ctx, {
        actorId: args.userId,
        action: "change_email",
        entityType: "users",
        entityId: args.userId,
      });
    }

    const existing = await ctx.db
      .query("emailVerificationState")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { email: challengeEmail, verifiedAt: now });
    } else {
      await ctx.db.insert("emailVerificationState", {
        userId: args.userId,
        email: challengeEmail,
        verifiedAt: now,
      });
    }
    return { ok: true as const, email: challengeEmail };
  },
});

export const status = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const state = await loadEmailVerification(ctx, userId);
    const now = Date.now();
    const recent = await ctx.db
      .query("emailVerificationChallenges")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(5);
    const pending = recent.find((row) => !row.usedAt && row.expiresAt > now);
    const pendingEmail =
      pending && state.email && normalizeEmail(pending.email) !== state.email
        ? normalizeEmail(pending.email)
        : null;
    return {
      ...state,
      pendingEmail,
      pendingMaskedEmail: pendingEmail ? maskEmail(pendingEmail) : null,
    };
  },
});

async function issueOtp(
  ctx: ActionCtx,
  userId: Id<"users">,
  email: string,
): Promise<{ retryAfterMs: number; sent: boolean }> {
  const code = createEmailOtpCode();
  const now = Date.now();
  const inserted = await ctx.runMutation(internal.emailVerification.insertChallenge, {
    userId,
    email,
    codeHash: await hashEmailOtp(userId, email, code),
    expiresAt: now + EMAIL_OTP_TTL_MS,
    createdAt: now,
  });
  if (!inserted.ok) {
    return { retryAfterMs: inserted.retryAfterMs, sent: false as const };
  }
  try {
    await sendTransactionalEmail(
      email,
      renderEmailOtpEmail({ code, expiresInMinutes: 10 }),
      "email-otp",
    );
  } catch (error) {
    await ctx.runMutation(internal.emailVerification.discardUnusedChallenge, {
      challengeId: inserted.challengeId,
    });
    throw error;
  }
  return { retryAfterMs: inserted.retryAfterMs, sent: true as const };
}

function otpThrottleMessage(retryAfterMs: number): string {
  if (retryAfterMs >= EMAIL_OTP_TTL_MS) {
    return "Too many verification emails. Try again later.";
  }
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `Wait ${seconds}s before requesting another code.`;
}

export const requestEmailVerification = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    | { ok: true; alreadyVerified: true; maskedEmail: string }
    | {
        ok: true;
        alreadyVerified: false;
        maskedEmail: string;
        retryAfterMs: number;
      }
  > => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to verify your email.");
    const state = await ctx.runQuery(internal.emailVerification.getState, { userId });
    if (!state.email) throw new Error("Add an email address before verifying.");
    if (state.emailVerified) {
      return {
        ok: true as const,
        alreadyVerified: true as const,
        maskedEmail: state.maskedEmail ?? maskEmail(state.email),
      };
    }
    const active = await ctx.runQuery(internal.emailVerification.getActiveChallenge, { userId });
    const targetEmail = active?.email ? normalizeEmail(active.email) : state.email;
    const issued = await issueOtp(ctx, userId, targetEmail);
    if (!issued.sent) throw new Error(otpThrottleMessage(issued.retryAfterMs));
    return {
      ok: true as const,
      alreadyVerified: false as const,
      maskedEmail: maskEmail(targetEmail),
      retryAfterMs: issued.retryAfterMs,
    };
  },
});

export const verifyEmailOtp = action({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to verify your email.");
    const state = await ctx.runQuery(internal.emailVerification.getState, { userId });
    if (state.emailVerified) return { ok: true as const, alreadyVerified: true as const };
    if (!state.email) throw new Error(emailOtpGenericError());
    const code = args.code.replace(/\D/g, "");
    if (!/^\d{6}$/.test(code)) throw new Error(emailOtpGenericError());
    const active = await ctx.runQuery(internal.emailVerification.getActiveChallenge, { userId });
    if (!active) throw new Error(emailOtpGenericError());
    const challengeEmail = normalizeEmail(active.email);
    const consumed = await ctx.runMutation(internal.emailVerification.consumeChallenge, {
      userId,
      codeHash: await hashEmailOtp(userId, challengeEmail, code),
    });
    if (!consumed.ok) {
      if (consumed.reason === "taken") throw new Error(EMAIL_TAKEN_ERROR);
      throw new Error(emailOtpGenericError());
    }
    return { ok: true as const, alreadyVerified: false as const };
  },
});

export const changeOwnEmail = action({
  args: { email: v.string(), currentPassword: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true; email: string; maskedEmail: string; retryAfterMs: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to update your email.");
    const email = normalizeEmail(args.email);
    if (!isWellFormedEmail(email)) throw new Error("Enter a valid email address.");
    const state = await ctx.runQuery(internal.emailVerification.getState, { userId });
    if (!state.email) throw new Error("Add an email address before updating it.");

    const passwordAccount = await ctx.runQuery(internal.emailVerification.getPasswordAccount, {
      userId,
    });
    if (!passwordAccount) throw new Error(EMAIL_MISSING_ACCOUNT_ERROR);

    const decision = await ctx.runMutation(internal.loginGuards.beginCredentialAttempt, {
      purpose: "email_change",
      email: state.email,
      now: Date.now(),
    });
    if (!decision.allowed) throw new Error(EMAIL_RATE_LIMIT_ERROR);
    if (decision.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, decision.delayMs));
    }
    try {
      // Use the stored providerAccountId — it may not match users.email casing.
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: passwordAccount.providerAccountId, secret: args.currentPassword },
      });
    } catch {
      throw new Error(WRONG_PASSWORD_ERROR);
    }
    await ctx.runMutation(internal.loginGuards.clearCredentialFailures, {
      purpose: "email_change",
      email: state.email,
    });

    if (email !== state.email) {
      const taken = await ctx.runQuery(internal.emailVerification.isEmailTaken, {
        userId,
        email,
      });
      if (taken) throw new Error(EMAIL_TAKEN_ERROR);
    }

    // Send OTP to the new address first; login email switches only after verify.
    let issued: { retryAfterMs: number; sent: boolean };
    try {
      issued = await issueOtp(ctx, userId, email);
    } catch {
      throw new Error(EMAIL_SEND_ERROR);
    }
    if (!issued.sent) throw new Error(otpThrottleMessage(issued.retryAfterMs));

    return {
      ok: true as const,
      email,
      maskedEmail: maskEmail(email),
      retryAfterMs: issued.retryAfterMs,
    };
  },
});
