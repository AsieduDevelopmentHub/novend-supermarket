import type { GenericDatabaseReader } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";
import { isEmailVerifiedRecord, maskEmail, normalizeEmail } from "./emailOtp";

export async function loadEmailVerification(
  ctx: { db: GenericDatabaseReader<DataModel> },
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!user?.email) {
    return {
      email: null as string | null,
      emailVerified: false as const,
      maskedEmail: null as string | null,
    };
  }
  const email = normalizeEmail(user.email);
  const row = await ctx.db
    .query("emailVerificationState")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  return {
    email,
    emailVerified: isEmailVerifiedRecord(row, email),
    maskedEmail: maskEmail(email),
  };
}
