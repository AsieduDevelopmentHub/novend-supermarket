"use client";

import { useState } from "react";
import { useConvex, useMutation } from "convex/react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { CloudUpload, Download, HardDrive, Trash2, Upload } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import { formatBytes } from "@/lib/bytes";
import {
  encryptOfflineBackup,
  exportOfflineBackup,
  importOfflineBackup,
  parseBackupPayload,
} from "@/lib/offline/backup";
import { exportCompactSnapshot } from "@/lib/offline/compact-snapshot";
import { showError } from "@/lib/errors";
import { uploadAndClaimStorage } from "@/lib/uploads/convex-storage";
import { toast } from "sonner";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useLicense } from "@/hooks/use-license";

function formatDateTime(value: number) {
  return new Date(value).toLocaleString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type CloudBackupCardProps = {
  canProtect: boolean;
  canUnlock: boolean;
  resolveSecret: (preferTyped?: boolean) => Promise<string | null>;
};

/**
 * Organization cloud backups / snapshots against the plan storage quota.
 * Encrypts with the organization recovery key.
 */
export function CloudBackupCard({ canProtect, canUnlock, resolveSecret }: CloudBackupCardProps) {
  const online = useConnectivity();
  const { cloudMode } = useLicense();
  const convex = useConvex();
  const usage = useAuthedQuery(api.cloudBackups.usage, online ? {} : "skip");
  const generateUploadUrl = useMutation(api.cloudBackups.generateBackupUploadUrl);
  const claimUpload = useMutation(api.storageUploads.claimBackup);
  const recordBackup = useMutation(api.cloudBackups.recordBackup);
  const deleteBackup = useMutation(api.cloudBackups.deleteBackup);
  const [uploading, setUploading] = useState(false);
  const [restoringId, setRestoringId] = useState<Id<"cloudBackups"> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Id<"cloudBackups"> | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<Id<"cloudBackups"> | null>(null);

  const snapshotMode = cloudMode === "snapshot_only";
  const scheduledMode = cloudMode === "backup_only" || snapshotMode;

  async function onBackupNow() {
    if (!canProtect) return;
    setUploading(true);
    try {
      const secret = await resolveSecret();
      if (!secret) throw new Error("Seal or enter the organization recovery key first");
      const payload = snapshotMode ? await exportCompactSnapshot() : await exportOfflineBackup();
      const encrypted = await encryptOfflineBackup(payload, secret);
      const blob = new Blob([JSON.stringify(encrypted)], { type: "application/octet-stream" });
      const storageId = await uploadAndClaimStorage({
        begin: () => generateUploadUrl({}),
        claim: (args) => claimUpload(args),
        body: blob,
        contentType: "application/octet-stream",
      });
      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = snapshotMode
        ? `novend-snapshot-${stamp}.novend-backup`
        : `novend-backup-${stamp}.novend-backup`;
      await recordBackup({
        storageId,
        fileName,
        kind: snapshotMode ? "snapshot" : "manual",
      });
      toast.success(snapshotMode ? "Snapshot saved to the cloud" : "Backup saved to the cloud");
    } catch (error) {
      showError(error, "Could not upload to the cloud");
    } finally {
      setUploading(false);
    }
  }

  async function downloadCloudFile(backupId: Id<"cloudBackups">, fileName: string) {
    const url = await convex.query(api.cloudBackups.backupDownloadUrl, { backupId });
    if (!url) throw new Error("That backup file is no longer available");
    const response = await fetch(url);
    if (!response.ok) throw new Error("Could not download that backup");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  async function onDownload(backupId: Id<"cloudBackups">, fileName: string) {
    try {
      await downloadCloudFile(backupId, fileName);
      toast.success("Downloaded");
    } catch (error) {
      showError(error, "Could not download");
    }
  }

  async function onRestore(backupId: Id<"cloudBackups">) {
    if (!canUnlock) return;
    setRestoringId(backupId);
    try {
      const secret = await resolveSecret(true);
      if (!secret) throw new Error("Enter the recovery key that encrypted this package");
      const url = await convex.query(api.cloudBackups.backupDownloadUrl, { backupId });
      if (!url) throw new Error("That backup file is no longer available");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not download that backup");
      const payload = await parseBackupPayload(await response.text(), secret);
      await importOfflineBackup(payload);
      toast.success("Cloud package restored — reload to refresh all views");
    } catch (error) {
      showError(error, "Could not restore cloud package");
    } finally {
      setRestoringId(null);
      setConfirmRestore(null);
    }
  }

  async function onDelete(backupId: Id<"cloudBackups">) {
    try {
      await deleteBackup({ backupId });
      toast.success("Deleted");
    } catch (error) {
      showError(error, "Could not delete");
    } finally {
      setConfirmDelete(null);
    }
  }

  if (!online) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-4 w-4" aria-hidden />
            Cloud
          </CardTitle>
          <CardDescription>
            Connect to the internet to upload, download, or restore organization cloud packages.
            This-device backups still work offline.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (usage === undefined) {
    return (
      <Card>
        <CardContent className="p-6">
          <LoadingState label="Loading cloud backups…" variant="form" />
        </CardContent>
      </Card>
    );
  }

  const percent =
    usage.limitBytes === null
      ? 0
      : Math.min(100, Math.round((usage.usedBytes / usage.limitBytes) * 100));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-4 w-4" aria-hidden />
          Cloud
        </CardTitle>
        <CardDescription>
          Encrypted copies on your plan&apos;s storage, protected by the organization recovery key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {scheduledMode ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {snapshotMode
              ? "Snapshot only is on: this till stays local and uploads a compact business package on the platform schedule when a recovery key is sealed."
              : "Backup only is on: this till stays local and uploads a full encrypted dump on the platform schedule when a recovery key is sealed."}
          </p>
        ) : null}
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">
              {formatBytes(usage.usedBytes)}
              <span className="text-muted-foreground font-normal">
                {" "}
                of {usage.limitBytes === null ? "unlimited" : formatBytes(usage.limitBytes)} used
              </span>
            </span>
            <span className="text-muted-foreground text-xs">
              Last cloud upload: {usage.lastBackupAt ? formatDateTime(usage.lastBackupAt) : "never"}
            </span>
          </div>
          {usage.limitBytes === null ? null : (
            <Progress value={percent} aria-label="Cloud backup usage" />
          )}
        </div>

        {usage.full ? (
          <Alert>
            <AlertTitle>Cloud storage is full</AlertTitle>
            <AlertDescription>
              Cloud uploads are paused. Delete an older package or upgrade your plan — this-device
              backups and the POS keep working.
            </AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="button"
          disabled={uploading || usage.full || !canProtect}
          onClick={() => void onBackupNow()}
        >
          <CloudUpload className="mr-2 h-4 w-4" aria-hidden />
          {uploading
            ? "Uploading…"
            : snapshotMode
              ? "Upload snapshot now"
              : "Back up to cloud"}
        </Button>

        {usage.backups.length > 0 ? (
          <ul className="border-border divide-border divide-y rounded-lg border">
            {usage.backups.map((backup) => (
              <li
                key={backup.id}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{backup.fileName}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDateTime(backup.createdAt)} · {formatBytes(backup.sizeBytes)}
                    {backup.kind === "snapshot"
                      ? " · snapshot"
                      : backup.kind === "automatic"
                        ? " · automatic"
                        : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Restore ${backup.fileName}`}
                    disabled={!canUnlock || restoringId === backup.id}
                    onClick={() => setConfirmRestore(backup.id)}
                  >
                    <Upload className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Download ${backup.fileName}`}
                    onClick={() => void onDownload(backup.id, backup.fileName)}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${backup.fileName}`}
                    onClick={() => setConfirmDelete(backup.id)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title="Delete this cloud package?"
        description="The stored copy is removed permanently and its space is freed."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDelete) void onDelete(confirmDelete);
        }}
      />
      <ConfirmDialog
        open={confirmRestore !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmRestore(null);
        }}
        title="Restore this cloud package?"
        description="This replaces all offline data on this device with the cloud copy. Unsynced changes may be lost."
        confirmLabel={restoringId ? "Restoring…" : "Restore"}
        confirmVariant="default"
        pending={Boolean(restoringId)}
        disableConfirm={!canUnlock}
        onConfirm={() => {
          if (confirmRestore) void onRestore(confirmRestore);
        }}
      />
    </Card>
  );
}
