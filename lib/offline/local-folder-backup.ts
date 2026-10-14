/**
 * Automatic local-folder backups for Millie's (`local_only`).
 *
 * Writes the same encrypted `.novend-backup` envelope as Novend POS Settings →
 * Backups, so a replacement till (or Novend POS) can restore with the recovery key.
 * Interval options match `BACKUP_INTERVAL_HOURS` (12h–30d).
 */

import {
  BACKUP_INTERVAL_HOURS,
  DEFAULT_BACKUP_INTERVAL_HOURS,
  normalizeBackupIntervalHours,
  type BackupIntervalHours,
} from "@/convex/shared/cloudMode";
import { brandedDocumentName } from "@/lib/export-filenames";
import { Hardware, isCapacitor, isElectron } from "@novend/hardware";
import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";
import { encryptOfflineBackup, exportOfflineBackup, rememberBackupTime } from "./backup";
import { loadSealedRecoveryKey } from "./recovery-key";
import { isScheduledBackupDue, SCHEDULED_BACKUP_RETRY_COOLDOWN_MS } from "./scheduled-backup";

const STORAGE = {
  enabled: "millies.localBackup.enabled",
  intervalHours: "millies.localBackup.intervalHours",
  folderPath: "millies.localBackup.folderPath",
} as const;

export const LOCAL_BACKUP_INTERVAL_OPTIONS: { value: BackupIntervalHours; label: string }[] =
  BACKUP_INTERVAL_HOURS.map((hours) => ({
    value: hours,
    label:
      hours === 12
        ? "Every 12 hours"
        : hours === 24
          ? "Every day"
          : hours === 48
            ? "Every 2 days"
            : hours === 168
              ? "Every 7 days"
              : hours === 336
                ? "Every 14 days"
                : "Every 30 days",
  }));

export type LocalFolderBackupSettings = {
  enabled: boolean;
  intervalHours: BackupIntervalHours;
  folderPath: string | null;
  lastBackupAt: number | null;
  /** Desktop can pick a folder; Cap uses Documents; browser needs a manual save. */
  folderSelectable: boolean;
  folderRequired: boolean;
};

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function desktopBridge() {
  if (typeof window === "undefined") return undefined;
  return window.novendDesktop;
}

export async function getDefaultBackupFolderPath(): Promise<string | null> {
  const bridge = desktopBridge();
  if (bridge?.getDefaultBackupFolder) {
    const result = await bridge.getDefaultBackupFolder();
    if (result.ok) return result.path;
  }
  if (isCapacitor()) return "Documents (app)";
  return null;
}

export async function loadLocalFolderBackupSettings(): Promise<LocalFolderBackupSettings> {
  const enabled = readStorage(STORAGE.enabled) !== "0";
  const intervalHours = normalizeBackupIntervalHours(
    Number(readStorage(STORAGE.intervalHours) ?? DEFAULT_BACKUP_INTERVAL_HOURS),
  );
  let folderPath = readStorage(STORAGE.folderPath);
  if (!folderPath && isElectron()) {
    folderPath = await getDefaultBackupFolderPath();
    if (folderPath) writeStorage(STORAGE.folderPath, folderPath);
  }
  if (!folderPath && isCapacitor()) {
    folderPath = "Documents (app)";
  }

  const db = await getOfflineDb();
  const lastRaw = db ? await getMeta(db, META_KEYS.scheduledLocalFolderBackupAt) : null;
  const lastBackupAt = lastRaw ? Number(lastRaw) : null;

  return {
    enabled,
    intervalHours,
    folderPath,
    lastBackupAt: Number.isFinite(lastBackupAt) && (lastBackupAt ?? 0) > 0 ? lastBackupAt : null,
    folderSelectable: isElectron(),
    folderRequired: isElectron(),
  };
}

export async function setLocalFolderBackupEnabled(enabled: boolean) {
  writeStorage(STORAGE.enabled, enabled ? "1" : "0");
}

export async function setLocalFolderBackupIntervalHours(hours: unknown) {
  writeStorage(STORAGE.intervalHours, String(normalizeBackupIntervalHours(hours)));
}

export async function setLocalFolderBackupPath(path: string) {
  const trimmed = path.trim();
  if (!trimmed) throw new Error("Choose a backup folder");
  writeStorage(STORAGE.folderPath, trimmed);
}

/** Open the OS folder picker (Electron only). */
export async function pickLocalBackupFolder(): Promise<string | null> {
  const bridge = desktopBridge();
  if (!bridge?.pickBackupFolder) {
    throw new Error("Changing the backup folder requires the desktop app.");
  }
  const current = readStorage(STORAGE.folderPath) ?? undefined;
  const result = await bridge.pickBackupFolder(current);
  if (!result.ok || !result.path) return null;
  writeStorage(STORAGE.folderPath, result.path);
  return result.path;
}

export async function openLocalBackupFolder(): Promise<void> {
  const settings = await loadLocalFolderBackupSettings();
  const bridge = desktopBridge();
  if (settings.folderPath && bridge?.openBackupFolder) {
    await bridge.openBackupFolder(settings.folderPath);
    return;
  }
  throw new Error("Open the Documents folder on this device to find backups.");
}

let inFlight: Promise<boolean> | null = null;

/** Run when due (interval), or force immediately. */
export async function maybeRunLocalFolderBackup(options?: {
  force?: boolean;
}): Promise<boolean> {
  if (inFlight) return inFlight;
  inFlight = runLocalFolderBackup(options).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runLocalFolderBackup(options?: { force?: boolean }): Promise<boolean> {
  try {
    const settings = await loadLocalFolderBackupSettings();
    if (!options?.force && !settings.enabled) return false;

    if (typeof window !== "undefined" && !isElectron() && !isCapacitor()) {
      // Browser cannot write to a watched folder on a schedule.
      return false;
    }

    const organizationId =
      typeof window !== "undefined"
        ? window.localStorage.getItem("novend.offlineOrganizationId")
        : null;
    if (!organizationId) return false;

    const password = await loadSealedRecoveryKey(organizationId);
    if (!password) return false;

    const db = await getOfflineDb();
    if (!db) return false;

    const now = Date.now();
    if (!options?.force) {
      const lastRaw = await getMeta(db, META_KEYS.scheduledLocalFolderBackupAt);
      const last = lastRaw ? Number(lastRaw) : 0;
      if (!isScheduledBackupDue(last, now, settings.intervalHours)) return false;

      const attemptRaw = await getMeta(db, META_KEYS.scheduledLocalFolderBackupAttemptAt);
      const attemptAt = attemptRaw ? Number(attemptRaw) : 0;
      if (
        Number.isFinite(attemptAt) &&
        attemptAt > 0 &&
        now - attemptAt < SCHEDULED_BACKUP_RETRY_COOLDOWN_MS
      ) {
        return false;
      }
    }

    await setMeta(db, META_KEYS.scheduledLocalFolderBackupAttemptAt, String(now));

    if (isElectron()) {
      let folder = settings.folderPath;
      if (!folder) {
        folder = await getDefaultBackupFolderPath();
        if (folder) writeStorage(STORAGE.folderPath, folder);
      }
      if (!folder) return false;

      const bridge = desktopBridge();
      if (!bridge?.writeBackupFile) return false;

      const payload = await exportOfflineBackup();
      const encrypted = await encryptOfflineBackup(payload, password);
      const stamp = new Date(payload.exportedAt).toISOString().slice(0, 10);
      const fileName = brandedDocumentName("Offline-Backup", stamp, "novend-backup");
      const written = await bridge.writeBackupFile({
        folderPath: folder,
        fileName,
        contents: JSON.stringify(encrypted),
      });
      if (!written.ok) throw new Error(written.message || "Could not write backup file");

      const doneAt = Date.now();
      await setMeta(db, META_KEYS.scheduledLocalFolderBackupAt, String(doneAt));
      await setMeta(db, META_KEYS.scheduledLocalFolderBackupAttemptAt, String(doneAt));
      await rememberBackupTime(payload.exportedAt);
      return true;
    }

    if (isCapacitor()) {
      const payload = await exportOfflineBackup();
      const encrypted = await encryptOfflineBackup(payload, password);
      const stamp = new Date(payload.exportedAt).toISOString().slice(0, 10);
      const fileName = brandedDocumentName("Offline-Backup", stamp, "novend-backup");
      const bytes = new TextEncoder().encode(JSON.stringify(encrypted));
      const saved = await Hardware.filesystem.saveImage(bytes, fileName);
      if (!saved.ok) throw new Error(saved.message || "Could not save backup");

      const doneAt = Date.now();
      await setMeta(db, META_KEYS.scheduledLocalFolderBackupAt, String(doneAt));
      await setMeta(db, META_KEYS.scheduledLocalFolderBackupAttemptAt, String(doneAt));
      await rememberBackupTime(payload.exportedAt);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export { DEFAULT_BACKUP_INTERVAL_HOURS, normalizeBackupIntervalHours };
