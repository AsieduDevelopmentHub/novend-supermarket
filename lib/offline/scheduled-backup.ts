/**
 * Automatic cloud upload for `backup_only` and `snapshot_only` organizations.
 *
 * Encrypts with the sealed organization recovery key (no Settings panel required).
 * backup_only → full Dexie dump; snapshot_only → compact business package.
 * No-op unless online, policy allows the matching upload, a recovery key is
 * sealed, and the platform interval has elapsed.
 *
 * Export + PBKDF2 run on the JS thread and can freeze Capacitor WebViews — callers
 * must delay the first attempt after shell load, and this module serializes runs.
 */

import type { Id } from "@/convex/_generated/dataModel";
import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";
import { backupIntervalMs } from "@/convex/shared/cloudMode";
import { loadCloudPolicy } from "./cloud-policy";
import { loadLicenseSnapshot } from "./license";
import { loadSealedRecoveryKey } from "./recovery-key";
import { encryptOfflineBackup, exportOfflineBackup } from "./backup";
import { exportCompactSnapshot } from "./compact-snapshot";
import { uploadAndClaimStorage } from "@/lib/uploads/convex-storage";

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
    kind: "automatic" | "snapshot";
  }) => Promise<unknown>;
};

/** Minimum gap after a failed/in-progress attempt before retrying (avoids remount storms). */
export const SCHEDULED_BACKUP_RETRY_COOLDOWN_MS = 60 * 60 * 1000;

let inFlight: Promise<boolean> | null = null;

/** True when the last automatic upload is older than the configured interval. */
export function isScheduledBackupDue(
  lastAtMs: number,
  nowMs: number,
  intervalHours: unknown,
): boolean {
  if (!Number.isFinite(lastAtMs) || lastAtMs <= 0) return true;
  return nowMs - lastAtMs >= backupIntervalMs(intervalHours);
}

/** Runs a scheduled cloud upload when the org is backup_only or snapshot_only. */
export async function maybeRunScheduledCloudBackup(deps: ScheduledBackupDeps): Promise<boolean> {
  if (inFlight) return inFlight;
  inFlight = runScheduledCloudBackup(deps).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runScheduledCloudBackup(deps: ScheduledBackupDeps): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) return false;

    const policy = await loadCloudPolicy();
    const wantBackup = policy.shouldQueueBackup() && !policy.shouldQueueRealtimeSync();
    const wantSnapshot = policy.shouldQueueSnapshot();
    if (!wantBackup && !wantSnapshot) return false;

    const license = await loadLicenseSnapshot();
    const organizationId = license?.organizationId;
    if (!organizationId) return false;

    const password = await loadSealedRecoveryKey(organizationId);
    if (!password) return false;

    const db = await getOfflineDb();
    if (!db) return false;

    const now = Date.now();
    const lastRaw = await getMeta(db, META_KEYS.scheduledCloudBackupAt);
    const last = lastRaw ? Number(lastRaw) : 0;
    if (!isScheduledBackupDue(last, now, license.backupIntervalHours)) return false;

    const attemptRaw = await getMeta(db, META_KEYS.scheduledCloudBackupAttemptAt);
    const attemptAt = attemptRaw ? Number(attemptRaw) : 0;
    if (
      Number.isFinite(attemptAt) &&
      attemptAt > 0 &&
      now - attemptAt < SCHEDULED_BACKUP_RETRY_COOLDOWN_MS
    ) {
      return false;
    }

    // Stamp before heavy work so remounts / online flickers do not re-enter export+PBKDF2.
    await setMeta(db, META_KEYS.scheduledCloudBackupAttemptAt, String(now));

    const payload = wantSnapshot ? await exportCompactSnapshot() : await exportOfflineBackup();
    const encrypted = await encryptOfflineBackup(payload, password);
    const blob = new Blob([JSON.stringify(encrypted)], { type: "application/octet-stream" });
    const storageId = await uploadAndClaimStorage({
      begin: () => deps.generateBackupUploadUrl(),
      claim: (args) => deps.claimBackup(args),
      body: blob,
      contentType: "application/octet-stream",
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = wantSnapshot
      ? `novend-snapshot-${stamp}.novend-backup`
      : `novend-backup-${stamp}.novend-backup`;
    await deps.recordBackup({
      storageId,
      fileName,
      kind: wantSnapshot ? "snapshot" : "automatic",
    });

    const doneAt = Date.now();
    await setMeta(db, META_KEYS.scheduledCloudBackupAt, String(doneAt));
    await setMeta(db, META_KEYS.scheduledCloudBackupAttemptAt, String(doneAt));
    return true;
  } catch {
    return false;
  }
}
