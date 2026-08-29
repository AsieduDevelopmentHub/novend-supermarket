import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";
import {
  assertStorageClaimForOrg,
  canClaimStorageForOrg,
} from "./tenancy";

const SESSION_TTL_MS = 30 * 60 * 1000;

type MutationCtx = GenericMutationCtx<DataModel>;

export type StorageUploadPurpose = "productImage" | "profileImage" | "cloudBackup";

export async function beginStorageUploadSession(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    purpose: StorageUploadPurpose;
  },
) {
  const now = Date.now();
  return await ctx.db.insert("storageUploadSessions", {
    organizationId: args.organizationId,
    userId: args.userId,
    purpose: args.purpose,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
}

export async function claimStorageUploadSession(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"storageUploadSessions">;
    storageId: Id<"_storage">;
    organizationId: Id<"organizations">;
    userId: Id<"users">;
  },
) {
  const session = await ctx.db.get(args.sessionId);
  if (
    !session ||
    session.organizationId !== args.organizationId ||
    session.userId !== args.userId
  ) {
    throw new Error("Uploaded file not found");
  }
  if (session.expiresAt < Date.now()) {
    throw new Error("Upload expired. Try again.");
  }

  const existing = await ctx.db
    .query("storageUploadSessions")
    .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
    .unique();
  if (existing && existing._id !== session._id) {
    if (!canClaimStorageForOrg(existing, args.organizationId)) {
      throw new Error("Uploaded file not found");
    }
  }

  await ctx.db.patch(session._id, {
    storageId: args.storageId,
    claimedAt: Date.now(),
  });
}

export async function assertOwnedStorage(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  organizationId: Id<"organizations">,
) {
  const claim = await ctx.db
    .query("storageUploadSessions")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
  assertStorageClaimForOrg(
    claim
      ? { organizationId: String(claim.organizationId), storageId: String(claim.storageId) }
      : null,
    String(organizationId),
  );
}
