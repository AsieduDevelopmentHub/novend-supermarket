import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

export const DEFAULT_BRANCH_NAME = "Main Branch";
export const DEFAULT_BRANCH_CODE = "MAIN";

type Ctx = QueryCtx | MutationCtx;

export async function findDefaultBranch(
  ctx: Ctx,
  organizationId: Id<"organizations">,
): Promise<Doc<"branches"> | null> {
  return await ctx.db
    .query("branches")
    .withIndex("by_organization_code", (q) =>
      q.eq("organizationId", organizationId).eq("code", DEFAULT_BRANCH_CODE),
    )
    .unique();
}

export async function ensureDefaultBranch(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<Id<"branches">> {
  const existing = await findDefaultBranch(ctx, organizationId);
  if (existing) return existing._id;
  return await ctx.db.insert("branches", {
    organizationId,
    name: DEFAULT_BRANCH_NAME,
    code: DEFAULT_BRANCH_CODE,
    status: "active",
    createdAt: Date.now(),
  });
}


