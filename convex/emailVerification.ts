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

const GENERIC_CHANGE_ERROR = "That email cannot be used.";

export const getState = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => loadEmailVerification(ctx, args.userId),
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
    await ctx.db.patch(active._id, { usedAt: now });
    const existing = await ctx.db
      .query("emailVerificationState")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { email: active.email, verifiedAt: now });
    } else {
      await ctx.db.insert("emailVerificationState", {
        userId: args.userId,
        email: active.email,
        verifiedAt: now,
      });
    }
    return { ok: true as const, email: active.email };
  },
});

export const applyOwnEmailChange = internalMutation({
  args: { userId: v.id("users"), newEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return { ok: false as const, reason: "missing" as const };
    const currentEmail = user.email ? normalizeEmail(user.email) : null;
    const newEmail = normalizeEmail(args.newEmail);
    if (currentEmail === newEmail) {
      return { ok: true as const, email: newEmail, unchanged: true as const };
    }

    const taken = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", newEmail),
      )
      .unique();
    if (taken && taken.userId !== args.userId) {
      return { ok: false as const, reason: "taken" as const };
    }

    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", args.userId).eq("provider", "password"))
      .unique();
    if (!account) return { ok: false as const, reason: "missing" as const };

    await ctx.db.patch(args.userId, { email: newEmail });
    await ctx.db.patch(account._id, { providerAccountId: newEmail });

    const verified = await ctx.db
      .query("emailVerificationState")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (verified) {
      await ctx.db.delete(verified._id);
    }
    const open = await ctx.db
      .query("emailVerificationChallenges")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .take(20);
    const now = Date.now();
    for (const row of open) {
      if (!row.usedAt) await ctx.db.patch(row._id, { usedAt: now });
    }
    await writeAuditLog(ctx, {
      actorId: args.userId,
      action: "change_email",
      entityType: "users",
      entityId: args.userId,
    });
    return { ok: true as const, email: newEmail, unchanged: false as const };
  },
});

export const status = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await loadEmailVerification(ctx, userId);
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
    const issued = await issueOtp(ctx, userId, state.email);
    return {
      ok: true as const,
      alreadyVerified: false as const,
      maskedEmail: state.maskedEmail ?? maskEmail(state.email),
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
    const consumed = await ctx.runMutation(internal.emailVerification.consumeChallenge, {
      userId,
      codeHash: await hashEmailOtp(userId, state.email, code),
    });
    if (!consumed.ok) throw new Error(emailOtpGenericError());
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
    const decision = await ctx.runMutation(internal.loginGuards.beginCredentialAttempt, {
      purpose: "email_change",
      email: state.email,
      now: Date.now(),
    });
    if (!decision.allowed) throw new Error(GENERIC_CHANGE_ERROR);
    if (decision.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, decision.delayMs));
    }
    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: state.email, secret: args.currentPassword },
      });
    } catch {
      throw new Error(GENERIC_CHANGE_ERROR);
    }
    await ctx.runMutation(internal.loginGuards.clearCredentialFailures, {
      purpose: "email_change",
      email: state.email,
    });
    const changed = await ctx.runMutation(internal.emailVerification.applyOwnEmailChange, {
      userId,
      newEmail: email,
    });
    if (!changed.ok) {
      throw new Error(GENERIC_CHANGE_ERROR);
    }
    const issued = await issueOtp(ctx, userId, changed.email);
    return {
      ok: true as const,
      email: changed.email,
      maskedEmail: maskEmail(changed.email),
      retryAfterMs: issued.retryAfterMs,
    };
  },
});
