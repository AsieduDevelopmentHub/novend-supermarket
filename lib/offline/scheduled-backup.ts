/**
 * Automatic cloud backup for `backup_only` organizations.
 *
 * In `backup_only` mode the cloud policy queues backups but not realtime sync.
 * This runner performs a daily encrypted cloud backup (export → encrypt →
 * upload → record) without flushing the business outbox. It is a no-op unless:
 *   - the device is online,
 *   - the cloud policy allows backups but not realtime sync (i.e. backup_only),
 *   - a valid backup password is available in this session, and
 *   - the last automatic cloud backup was more than 24h ago.
 *
 * The backup password is never persisted, so this silently skips when the admin
 * has not entered one. Convex re-checks admin role and the storage quota.
 * See docs/architecture/CLOUD_MODE_PLAN_V2.md (§Phase D) and OFFLINE_SYNC.md.
 */

import type { Id } from "@/convex/_generated/dataModel";
import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";
import { loadCloudPolicy } from "./cloud-policy";
import { getSessionBackupPassword } from "./backup-password";
import { encryptOfflineBackup, exportOfflineBackup } from "./backup";
import { uploadAndClaimStorage } from "@/lib/uploads/convex-storage";

const SCHEDULED_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

type BeginUpload = () => Promise<{
  uploadUrl: string;
  sessionId: Id<"storageUploadSessions">;
}>;

export type ScheduledBackupDeps = {
  generateBackupUploadUrl: BeginUpload;
  claimBackup: (args: {
    sessionId: Id<"storageUploadSessions">;
    storageId: Id<"_storage">;
  }) => Promise<unknown>;
  recordBackup: (args: {
    storageId: Id<"_storage">;
    fileName: string;
    kind: "automatic";
  }) => Promise<unknown>;
};

/** Runs a daily automatic cloud backup when the org is in backup_only mode. */
export async function maybeRunScheduledCloudBackup(deps: ScheduledBackupDeps): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) return false;

    const policy = await loadCloudPolicy();
    // Only backup_only: backups queued, realtime sync off. full_sync uses the
    // normal sync/backup path; local_only never backs up to the cloud.
    if (!policy.shouldQueueBackup() || policy.shouldQueueRealtimeSync()) return false;

    const password = getSessionBackupPassword();
    if (!password) return false;

    const db = await getOfflineDb();
    const lastRaw = db ? await getMeta(db, META_KEYS.scheduledCloudBackupAt) : null;
    const last = lastRaw ? Number(lastRaw) : 0;
    if (Number.isFinite(last) && Date.now() - last < SCHEDULED_BACKUP_INTERVAL_MS) return false;

    const payload = await exportOfflineBackup();
    const encrypted = await encryptOfflineBackup(payload, password);
    const blob = new Blob([JSON.stringify(encrypted)], { type: "application/octet-stream" });
    const storageId = await uploadAndClaimStorage({
      begin: () => deps.generateBackupUploadUrl(),
      claim: (args) => deps.claimBackup(args),
      body: blob,
      contentType: "application/octet-stream",
    });
    const fileName = `novend-backup-${new Date().toISOString().slice(0, 10)}.novend-backup`;
    await deps.recordBackup({ storageId, fileName, kind: "automatic" });

    if (db) await setMeta(db, META_KEYS.scheduledCloudBackupAt, String(Date.now()));
    return true;
  } catch {
    // Automatic backups are best-effort and must never disrupt the app.
    return false;
  }
}
