import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function lockMessage(lockedUntil: number) {
  const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60_000));
  return `Too many failed sign-in attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/**
 * Call before attempting password sign-in. Throws when the email is locked out.
 */
export const assertLoginAllowed = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email) throw new Error("Email is required");

    const row = await ctx.db
      .query("loginAttempts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (!row?.lockedUntil) {
      return { ok: true as const, lockedUntil: null };
    }

    if (row.lockedUntil > Date.now()) {
      throw new Error(lockMessage(row.lockedUntil));
    }

    return { ok: true as const, lockedUntil: null };
  },
});

/** Record a failed password attempt for an email (public; used from the login form). */
export const recordLoginFailure = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email) throw new Error("Email is required");

    const now = Date.now();
    const existing = await ctx.db
      .query("loginAttempts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (!existing) {
      await ctx.db.insert("loginAttempts", {
        email,
        failedCount: 1,
        windowStartedAt: now,
        updatedAt: now,
      });
      return { failedCount: 1, lockedUntil: null as number | null };
    }

    if (existing.lockedUntil && existing.lockedUntil > now) {
      throw new Error(lockMessage(existing.lockedUntil));
    }

    const windowExpired = now - existing.windowStartedAt > WINDOW_MS;
    const failedCount = windowExpired ? 1 : existing.failedCount + 1;
    const lockedUntil = failedCount >= MAX_FAILURES ? now + LOCK_MS : undefined;

    await ctx.db.patch(existing._id, {
      failedCount,
      windowStartedAt: windowExpired ? now : existing.windowStartedAt,
      lockedUntil,
      updatedAt: now,
    });

    if (lockedUntil) {
      throw new Error(lockMessage(lockedUntil));
    }

    return { failedCount, lockedUntil: null as number | null };
  },
});


/** Clear failure state after a successful authenticated sign-in. */
export const clearLoginFailures = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const user = await ctx.db.get(userId);
    const email = user?.email ? normalizeEmail(user.email) : null;
    if (!email) return;

    const existing = await ctx.db
      .query("loginAttempts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});


