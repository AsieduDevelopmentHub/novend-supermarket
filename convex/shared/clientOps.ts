import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/** Replay a previously applied outbox mutation. Null means apply for the first time. */
export async function replayClientOp<T>(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  clientOperationId: string | undefined,
): Promise<T | null> {
  const key = clientOperationId?.trim();
  if (!key) return null;
  const existing = await ctx.db
    .query("mutationClientOps")
    .withIndex("by_organization_clientOperationId", (q) =>
      q.eq("organizationId", organizationId).eq("clientOperationId", key),
    )
    .unique();
  if (!existing) return null;
  return JSON.parse(existing.resultJson) as T;
}

/** Persist the result so a later retry with the same clientOperationId is a no-op. */
export async function rememberClientOp(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    clientOperationId?: string;
    kind: string;
    result: unknown;
  },
) {
  const key = args.clientOperationId?.trim();
  if (!key) return;
  const existing = await ctx.db
    .query("mutationClientOps")
    .withIndex("by_organization_clientOperationId", (q) =>
      q.eq("organizationId", args.organizationId).eq("clientOperationId", key),
    )
    .unique();
  if (existing) return;
  await ctx.db.insert("mutationClientOps", {
    organizationId: args.organizationId,
    clientOperationId: key,
    kind: args.kind,
    resultJson: JSON.stringify(args.result),
    createdAt: Date.now(),
  });
}
