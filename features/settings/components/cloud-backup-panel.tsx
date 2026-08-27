"use client";

import { useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
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
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import { useConnectivity } from "@/hooks/use-connectivity";

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
  password: string;
  canProtect: boolean;
  canUnlock: boolean;
};

/**
 * Organization cloud backups against the plan storage quota.
 * Uploads and restores always go through the same backup password as This device.
 */
export function CloudBackupCard({ password, canProtect, canUnlock }: CloudBackupCardProps) {
  const online = useConnectivity();
  const convex = useConvex();
  const usage = useQuery(api.cloudBackups.usage, online ? {} : "skip");
  const generateUploadUrl = useMutation(api.cloudBackups.generateBackupUploadUrl);
  const recordBackup = useMutation(api.cloudBackups.recordBackup);
  const deleteBackup = useMutation(api.cloudBackups.deleteBackup);
  const [uploading, setUploading] = useState(false);
  const [restoringId, setRestoringId] = useState<Id<"cloudBackups"> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Id<"cloudBackups"> | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<Id<"cloudBackups"> | null>(null);

  async function onBackupNow() {
    if (!canProtect) return;
    setUploading(true);
    try {
      const payload = await exportOfflineBackup();
      const encrypted = await encryptOfflineBackup(payload, password);
      const blob = new Blob([JSON.stringify(encrypted)], { type: "application/octet-stream" });
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: blob,
      });
      if (!response.ok) throw new Error("Upload failed. Check your connection and try again.");
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      const fileName = `novend-backup-${new Date().toISOString().slice(0, 10)}.novend-backup`;
      await recordBackup({ storageId, fileName, kind: "manual" });
      toast.success("Backup saved to the cloud");
    } catch (error) {
      showError(error, "Could not back up to the cloud");
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
      toast.success("Backup downloaded");
    } catch (error) {
      showError(error, "Could not download backup");
    }
  }

  async function onRestore(backupId: Id<"cloudBackups">) {
    if (!canUnlock) return;
    setRestoringId(backupId);
    try {
      const url = await convex.query(api.cloudBackups.backupDownloadUrl, { backupId });
      if (!url) throw new Error("That backup file is no longer available");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not download that backup");
      const payload = await parseBackupPayload(await response.text(), password);
      await importOfflineBackup(payload);
      toast.success("Cloud backup restored — reload to refresh all views");
    } catch (error) {
      showError(error, "Could not restore cloud backup");
    } finally {
      setRestoringId(null);
      setConfirmRestore(null);
    }
  }

  async function onDelete(backupId: Id<"cloudBackups">) {
    try {
      await deleteBackup({ backupId });
      toast.success("Backup deleted");
    } catch (error) {
      showError(error, "Could not delete backup");
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
            Connect to the internet to upload, download, or restore organization cloud backups.
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
          Encrypted copies on your plan&apos;s storage. Same backup password as this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
              Last cloud backup: {usage.lastBackupAt ? formatDateTime(usage.lastBackupAt) : "never"}
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
              Cloud uploads are paused. Delete an older backup or upgrade your plan — this-device
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
          {uploading ? "Backing up…" : "Back up to cloud"}
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
        title="Delete this cloud backup?"
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
        title="Restore this cloud backup?"
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
