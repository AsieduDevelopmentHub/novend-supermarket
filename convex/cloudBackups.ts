import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRoleIgnoringLicense } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import { countUsage, resolveLicense } from "./shared/entitlements";
import { limitReachedMessage } from "./shared/plans";
import { sanitizeText, TEXT_LIMITS } from "./shared/validation";
import { assertOwnedStorage, beginStorageUploadSession } from "./shared/storageSessions";

const MAX_BACKUP_BYTES = 200 * 1024 * 1024;

/**
 * Cloud backup storage for an organization.
 *
 * Quotas pause cloud uploads only. This-device backups in Settings → Backups
 * and the POS itself never stop because storage is full — see
 * `lib/offline/backup.ts`.
 */
export const usage = query({
  args: {},
  handler: async (ctx) => {
    const { organization, organizationId } = await requireRoleIgnoringLicense(ctx, [
      "administrator",
    ]);
    const license = await resolveLicense(ctx, organization);
    const counts = await countUsage(ctx, organizationId);
    const backups = await ctx.db
      .query("cloudBackups")
      .withIndex("by_organization_createdAt", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(20);

    const limit = license.limits.backupBytes;
    return {
      usedBytes: counts.backupBytes,
      limitBytes: limit,
      remainingBytes: limit === null ? null : Math.max(0, limit - counts.backupBytes),
      full: limit !== null && counts.backupBytes >= limit,
      lastBackupAt: backups[0]?.createdAt ?? null,
      backups: backups.map((backup) => ({
        id: backup._id,
        fileName: backup.fileName,
        sizeBytes: backup.sizeBytes,
        kind: backup.kind,
        createdAt: backup.createdAt,
      })),
    };
  },
});

export const generateBackupUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const { organization, organizationId, userId } = await requireRoleIgnoringLicense(ctx, [
      "administrator",
    ]);
    const license = await resolveLicense(ctx, organization);
    const limit = license.limits.backupBytes;
    if (limit !== null) {
      const counts = await countUsage(ctx, organizationId);
      if (counts.backupBytes >= limit) {
        throw new Error(limitReachedMessage(license.planKey, "backupBytes", limit));
      }
    }
    const sessionId = await beginStorageUploadSession(ctx, {
      organizationId,
      userId,
      purpose: "cloudBackup",
    });
    return { uploadUrl: await ctx.storage.generateUploadUrl(), sessionId };
  },
});

/** Records an uploaded backup. Rejects and cleans up when it exceeds the quota. */
export const recordBackup = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    kind: v.optional(v.union(v.literal("manual"), v.literal("automatic"), v.literal("snapshot"))),
  },
  handler: async (ctx, args) => {
    const { organization, organizationId, userId } = await requireRoleIgnoringLicense(ctx, [
      "administrator",
    ]);
    const metadata = await ctx.db.system.get(args.storageId);
    if (!metadata) throw new Error("Upload could not be found");
    await assertOwnedStorage(ctx, args.storageId, organizationId);

    const sizeBytes = metadata.size;
    if (sizeBytes > MAX_BACKUP_BYTES) {
      await ctx.storage.delete(args.storageId);
      throw new Error("That backup file is too large to store in the cloud.");
    }

    const license = await resolveLicense(ctx, organization);
    const limit = license.limits.backupBytes;
    if (limit !== null) {
      const counts = await countUsage(ctx, organizationId);
      if (counts.backupBytes + sizeBytes > limit) {
        await ctx.storage.delete(args.storageId);
        throw new Error(limitReachedMessage(license.planKey, "backupBytes", limit));
      }
    }

    const now = Date.now();
    const backupId = await ctx.db.insert("cloudBackups", {
      organizationId,
      storageId: args.storageId,
      fileName: sanitizeText(args.fileName, "File name", TEXT_LIMITS.name),
      sizeBytes,
      kind: args.kind ?? "manual",
      createdBy: userId,
      createdAt: now,
    });

    await writeAuditLog(ctx, {
      organizationId,
      actorId: userId,
      action: "cloud_backup_created",
      entityType: "cloudBackups",
      entityId: backupId,
      metadata: { sizeBytes },
    });

    return backupId;
  },
});

export const backupDownloadUrl = query({
  args: { backupId: v.id("cloudBackups") },
  handler: async (ctx, args) => {
    const { organizationId } = await requireRoleIgnoringLicense(ctx, ["administrator"]);
    const backup = await ctx.db.get(args.backupId);
    if (!backup || backup.organizationId !== organizationId) throw new Error("Not found");
    return await ctx.storage.getUrl(backup.storageId);
  },
});

export const deleteBackup = mutation({
  args: { backupId: v.id("cloudBackups") },
  handler: async (ctx, args) => {
    const { organizationId, userId } = await requireRoleIgnoringLicense(ctx, ["administrator"]);
    const backup = await ctx.db.get(args.backupId);
    if (!backup || backup.organizationId !== organizationId) throw new Error("Not found");
    try {
      await ctx.storage.delete(backup.storageId);
    } catch {
      /* file already gone; still remove the record */
    }
    await ctx.db.delete(backup._id);
    await writeAuditLog(ctx, {
      organizationId,
      actorId: userId,
      action: "cloud_backup_deleted",
      entityType: "cloudBackups",
      entityId: backup._id,
    });
  },
});
