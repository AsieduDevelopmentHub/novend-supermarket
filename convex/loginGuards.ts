import { v } from "convex/values";
import { query } from "./_generated/server";

/** Compatibility-only UX hint; throttling is enforced by the auth provider/edge. */
export const assertLoginAllowed = query({
  args: { email: v.string() },
  handler: async (_ctx, args) => {
    if (!args.email.trim()) throw new Error("Email is required");
    return { ok: true as const, lockedUntil: null };
  },
});
