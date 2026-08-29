import { invalidateSessions, modifyAccountCredentials } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { assertPasswordPolicy } from "./shared/passwordPolicy";
import {
  PASSWORD_RESET_MIN_INTERVAL_MS,
  PASSWORD_RESET_TTL_MS,
  createPasswordResetToken,
  hashPasswordResetToken,
  passwordResetRejectReason,
} from "./shared/passwordResetCrypto";
import { renderPasswordResetEmail } from "./shared/emailTemplates";
import {
  notifyPasswordChanged,
  publicAppUrl,
  sendTransactionalEmail,
} from "./shared/transactionalEmail";

const GENERIC_REQUEST_OK = {
  ok: true as const,
  message: "If that email has a Novend account, we sent a reset link.",
};

const GENERIC_TOKEN_ERROR = "This reset link is invalid or has expired.";

export const findPasswordAccount = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", args.email),
      )
      .unique();
    if (!account) return null;
    const user = await ctx.db.get(account.userId);
    if (!user) return null;
    return { userId: account.userId, email: args.email };
  },
});

export const insertResetToken = internalMutation({
  args: {
    email: v.string(),
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    const recent = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email_createdAt", (q) => q.eq("email", args.email))
      .order("desc")
      .take(5);
    if (recent[0] && args.createdAt - recent[0].createdAt < PASSWORD_RESET_MIN_INTERVAL_MS) {
      return { throttled: true as const };
    }
    for (const row of recent) {
      if (!row.usedAt) {
        await ctx.db.patch(row._id, { usedAt: args.createdAt });
      }
    }
    const tokenId = await ctx.db.insert("passwordResetTokens", {
      email: args.email,
      userId: args.userId,
      tokenHash: args.tokenHash,
      expiresAt: args.expiresAt,
      createdAt: args.createdAt,
    });
    return { throttled: false as const, tokenId };
  },
});

export const discardUnusedResetToken = internalMutation({
  args: { tokenId: v.id("passwordResetTokens") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.tokenId);
    if (row && !row.usedAt) {
      await ctx.db.delete(args.tokenId);
    }
  },
});

export const consumeResetToken = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (!row) return { ok: false as const, reason: "invalid" as const };
    const reason = passwordResetRejectReason(row);
    if (reason) return { ok: false as const, reason };
    await ctx.db.patch(row._id, { usedAt: Date.now() });
    return { ok: true as const, email: row.email, userId: row.userId };
  },
});

export const requestPasswordReset = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return GENERIC_REQUEST_OK;
    }
    const account = await ctx.runQuery(internal.passwordReset.findPasswordAccount, { email });
    if (!account) {
      return GENERIC_REQUEST_OK;
    }
    const token = createPasswordResetToken();
    const tokenHash = await hashPasswordResetToken(token);
    const now = Date.now();
    const inserted = await ctx.runMutation(internal.passwordReset.insertResetToken, {
      email,
      userId: account.userId,
      tokenHash,
      expiresAt: now + PASSWORD_RESET_TTL_MS,
      createdAt: now,
    });
    if (inserted.throttled) {
      return GENERIC_REQUEST_OK;
    }
    const origin = publicAppUrl();
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
    try {
      await sendTransactionalEmail(
        email,
        renderPasswordResetEmail({
          resetUrl,
          expiresInHours: 1,
        }),
        "password-reset",
      );
    } catch (error) {
      await ctx.runMutation(internal.passwordReset.discardUnusedResetToken, {
        tokenId: inserted.tokenId,
      });
      throw error;
    }
    return GENERIC_REQUEST_OK;
  },
});

export const completePasswordReset = action({
  args: {
    token: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertPasswordPolicy(args.newPassword);
    const token = args.token.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(token)) {
      throw new Error(GENERIC_TOKEN_ERROR);
    }
    const tokenHash = await hashPasswordResetToken(token);
    const consumed = await ctx.runMutation(internal.passwordReset.consumeResetToken, { tokenHash });
    if (!consumed.ok) {
      throw new Error(GENERIC_TOKEN_ERROR);
    }
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: consumed.email, secret: args.newPassword },
    });
    await invalidateSessions(ctx, { userId: consumed.userId });
    await notifyPasswordChanged(consumed.email);
    return { ok: true as const };
  },
});
