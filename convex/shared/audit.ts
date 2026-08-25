import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export async function writeAuditLog(
  ctx: MutationCtx,
  args: {
    actorId?: Id<"users">;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    organizationId?: Id<"organizations">;
  },
) {
  let organizationId = args.organizationId;
  if (!organizationId && args.actorId) {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.actorId!))
      .unique();
    organizationId = profile?.organizationId;
  }
  await ctx.db.insert("auditLogs", {
    organizationId,
    actorId: args.actorId,
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId ? String(args.entityId) : undefined,
    metadata: args.metadata ? JSON.stringify(args.metadata) : undefined,
    createdAt: Date.now(),
  });
}
