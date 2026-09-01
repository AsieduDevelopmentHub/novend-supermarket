import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { OrganizationStatus } from "./licensing";
import { writeAuditLog } from "./audit";

/** Grace period before a self-requested business closure becomes permanent. */
export const ACCOUNT_CLOSURE_GRACE_DAYS = 30;

export const ACCOUNT_CLOSURE_GRACE_MS = ACCOUNT_CLOSURE_GRACE_DAYS * 24 * 60 * 60 * 1000;

export function isOrganizationOwner(
  organization: Pick<Doc<"organizations">, "ownerUserId">,
  userId: Id<"users">,
): boolean {
  return organization.ownerUserId === userId;
}

export function hasPendingOrganizationClosure(
  organization: Pick<Doc<"organizations">, "closureEffectiveAt">,
  now = Date.now(),
): boolean {
  return organization.closureEffectiveAt !== undefined && organization.closureEffectiveAt > now;
}

/**
 * Archives an organization: blocks access and deactivates devices. Business records
 * are retained for audit — nothing is permanently erased.
 */
export async function archiveOrganizationRecord(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    actorId?: Id<"users">;
    auditAction?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ deactivatedDevices: number }> {
  const org = await ctx.db.get(args.organizationId);
  if (!org) throw new Error("Organization not found");

  const devices = await ctx.db
    .query("devices")
    .withIndex("by_organization_active", (q) =>
      q.eq("organizationId", args.organizationId).eq("isActive", true),
    )
    .collect();
  const now = Date.now();
  for (const device of devices) {
    await ctx.db.patch(device._id, {
      isActive: false,
      deactivatedAt: now,
      deactivatedBy: args.actorId,
    });
  }

  await ctx.db.patch(args.organizationId, {
    status: "disabled",
    updatedAt: now,
    closureRequestedAt: undefined,
    closureEffectiveAt: undefined,
    closureRequestedBy: undefined,
    closureReason: undefined,
    closurePreviousStatus: undefined,
  });

  await writeAuditLog(ctx, {
    organizationId: args.organizationId,
    actorId: args.actorId,
    action: args.auditAction ?? "archive_organization",
    entityType: "organizations",
    entityId: args.organizationId,
    metadata: {
      deactivatedDevices: devices.length,
      ...args.metadata,
    },
  });

  return { deactivatedDevices: devices.length };
}

export function normalizeRestorableStatus(
  status: OrganizationStatus | undefined,
): OrganizationStatus {
  if (!status || status === "disabled" || status === "inactive") return "active";
  return status;
}

export const CLOSURE_REASON_LABELS: Record<string, string> = {
  break: "Taking a break from the business",
  switching: "Switching to another system",
  cost: "Cost or billing concerns",
  features: "Missing features",
  support: "Support expectations",
  other: "Other",
};

export function formatClosureReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return CLOSURE_REASON_LABELS[reason] ?? reason;
}
