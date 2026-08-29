import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRole, requireRoleIgnoringLicense } from "./shared/permissions";
import { claimStorageUploadSession } from "./shared/storageSessions";

export const claim = mutation({
  args: {
    sessionId: v.id("storageUploadSessions"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
      "cashier",
    ]);
    await claimStorageUploadSession(ctx, {
      sessionId: args.sessionId,
      storageId: args.storageId,
      organizationId,
      userId,
    });
  },
});

export const claimBackup = mutation({
  args: {
    sessionId: v.id("storageUploadSessions"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireRoleIgnoringLicense(ctx, ["administrator"]);
    await claimStorageUploadSession(ctx, {
      sessionId: args.sessionId,
      storageId: args.storageId,
      organizationId,
      userId,
    });
  },
});
