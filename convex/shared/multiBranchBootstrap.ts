import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getProfileByUserId } from "./permissions";
import { ensureDefaultBranch } from "./defaultBranch";

export type MultiBranchBootstrapResult = {
  branchId: Id<"branches">;
  profilesUpdated: number;
  stockRows: number;
  salesUpdated: number;
  historyUpdated: number;
  expensesUpdated: number;
  heldUpdated: number;
};

/** Novend creates MAIN during organization onboarding. This is a no-op safety net. */
export async function bootstrapMultiBranch(ctx: MutationCtx): Promise<MultiBranchBootstrapResult> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthenticated");
  const profile = await getProfileByUserId(ctx, userId);
  if (!profile) {
    throw new Error("No staff profile for this account. Complete onboarding first.");
  }
  const branchId = profile.branchId ?? (await ensureDefaultBranch(ctx, profile.organizationId));
  if (!profile.branchId) {
    await ctx.db.patch(profile._id, { branchId });
  }
  return {
    branchId,
    profilesUpdated: 0,
    stockRows: 0,
    salesUpdated: 0,
    historyUpdated: 0,
    expensesUpdated: 0,
    heldUpdated: 0,
  };
}
