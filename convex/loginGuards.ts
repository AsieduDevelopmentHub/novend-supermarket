import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import {
  loginLimitDecision,
  normalizeLoginDeviceKey,
  recordLoginFailure,
} from "./shared/loginRateLimit";

const purposeValidator = v.union(v.literal("login"), v.literal("email_change"));

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Atomically reserves an attempt before password verification. Recording first
 * prevents a burst of concurrent requests from all passing the limit check.
 * Successful verification clears the reservation.
 */
export const beginCredentialAttempt = internalMutation({
  args: {
    purpose: purposeValidator,
    email: v.string(),
    deviceKey: v.optional(v.string()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const deviceKey = normalizeLoginDeviceKey(args.deviceKey);
    const row = await ctx.db
      .query("loginAttempts")
      .withIndex("by_purpose_email", (q) => q.eq("purpose", args.purpose).eq("email", email))
      .unique();
    const decision = loginLimitDecision(row, deviceKey, args.now);
    if (!decision.allowed) return decision;

    const next = recordLoginFailure(row, deviceKey, args.now);
    if (row) {
      await ctx.db.patch(row._id, { ...next, updatedAt: args.now });
    } else {
      await ctx.db.insert("loginAttempts", {
        purpose: args.purpose,
        email,
        ...next,
        updatedAt: args.now,
      });
    }
    return decision;
  },
});

export const clearCredentialFailures = internalMutation({
  args: {
    purpose: purposeValidator,
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("loginAttempts")
      .withIndex("by_purpose_email", (q) =>
        q.eq("purpose", args.purpose).eq("email", normalizeEmail(args.email)),
      )
      .unique();
    if (row) {
      await ctx.db.delete(row._id);
    }
    return { ok: true as const };
  },
});
