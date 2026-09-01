import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { formatActivityRow } from "./auditDisplay";

type Ctx = QueryCtx | MutationCtx;

export async function resolveAuditEntityLabel(
  ctx: Ctx,
  entityType: string,
  entityId: string | null | undefined,
  organizationId?: Id<"organizations">,
): Promise<string | null> {
  if (!entityId) return null;
  if (entityType === "profiles" || entityType === "staffCompensation") {
    const profile = await ctx.db.get(entityId as Id<"profiles">);
    if (profile && (!organizationId || profile.organizationId === organizationId)) {
      return profile.name;
    }
    return null;
  }
  if (entityType === "expenses") {
    const expense = await ctx.db.get(entityId as Id<"expenses">);
    if (expense && (!organizationId || expense.organizationId === organizationId)) {
      return expense.description ?? null;
    }
    return null;
  }
  if (entityType === "organizations") {
    const org = await ctx.db.get(entityId as Id<"organizations">);
    return org?.name ?? null;
  }
  if (entityType === "branches") {
    const branch = await ctx.db.get(entityId as Id<"branches">);
    if (branch && (!organizationId || branch.organizationId === organizationId)) {
      return branch.name;
    }
    return null;
  }
  if (entityType === "users") {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", entityId as Id<"users">))
      .first();
    if (profile && (!organizationId || profile.organizationId === organizationId)) {
      return profile.name;
    }
    return null;
  }
  return null;
}

export async function enrichAuditLogRow(
  ctx: Ctx,
  row: {
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: string | null;
    organizationId?: Id<"organizations"> | null;
  },
  options?: { organizationName?: string | null },
) {
  const entityLabel = await resolveAuditEntityLabel(
    ctx,
    row.entityType,
    row.entityId ?? null,
    row.organizationId ?? undefined,
  );
  const formatted = formatActivityRow({
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata,
    entityLabel,
    organizationName: options?.organizationName ?? null,
  });
  return {
    actionLabel: formatted.actionLabel,
    areaLabel: formatted.areaLabel,
    detail: formatted.detail,
    entityLabel,
  };
}
