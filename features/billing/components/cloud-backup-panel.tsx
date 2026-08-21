"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CloudUpload, HardDrive, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import { formatBytes } from "@/lib/bytes";
import { exportOfflineBackup } from "@/lib/offline/backup";
import { showError } from "@/lib/errors";
import { toast } from "sonner";

function formatDateTime(value: number) {
  return new Date(value).toLocaleString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Cloud backup with the plan's storage quota.
 *
 * When storage is full, cloud uploads pause and the local backup in
 * Settings → Local backup keeps working. The POS is never affected.
 */
export function CloudBackupPanel() {
  const usage = useQuery(api.cloudBackups.usage, {});
  const generateUploadUrl = useMutation(api.cloudBackups.generateBackupUploadUrl);
  const recordBackup = useMutation(api.cloudBackups.recordBackup);
  const deleteBackup = useMutation(api.cloudBackups.deleteBackup);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Id<"cloudBackups"> | null>(null);

  async function onBackupNow() {
    setUploading(true);
    try {
      const payload = await exportOfflineBackup();
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: blob,
      });
      if (!response.ok) throw new Error("Upload failed. Check your connection and try again.");
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      const fileName = `novend-backup-${new Date().toISOString().slice(0, 10)}.json`;
      await recordBackup({ storageId, fileName, kind: "manual" });
      toast.success("Backup saved to the cloud");
    } catch (error) {
      showError(error, "Could not back up to the cloud");
    } finally {
      setUploading(false);
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

  if (usage === undefined) {
    return (
      <Card>
        <CardContent className="p-6">
          <LoadingState label="Loading cloud backup…" variant="form" />
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
          Cloud backup
        </CardTitle>
        <CardDescription>
          Encrypted copies of this terminal&apos;s data kept on your plan&apos;s storage.
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
              Last backup: {usage.lastBackupAt ? formatDateTime(usage.lastBackupAt) : "never"}
            </span>
          </div>
          {usage.limitBytes === null ? null : <Progress value={percent} aria-label="Cloud backup usage" />}
        </div>

        {usage.full ? (
          <Alert>
            <AlertTitle>Cloud storage is full</AlertTitle>
            <AlertDescription>
              Cloud backups are paused. Delete an older backup or upgrade your plan — local backups
              and the POS keep working.
            </AlertDescription>
          </Alert>
        ) : null}

        <Button type="button" disabled={uploading || usage.full} onClick={() => void onBackupNow()}>
          <CloudUpload className="mr-2 h-4 w-4" aria-hidden />
          {uploading ? "Backing up…" : "Back up now"}
        </Button>

        {usage.backups.length > 0 ? (
          <ul className="border-border divide-border divide-y rounded-lg border">
            {usage.backups.map((backup) => (
              <li key={backup.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{backup.fileName}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDateTime(backup.createdAt)} · {formatBytes(backup.sizeBytes)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${backup.fileName}`}
                  onClick={() => setConfirmDelete(backup.id)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
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
        title="Delete this backup?"
        description="The stored copy is removed permanently and its space is freed."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDelete) void onDelete(confirmDelete);
        }}
      />
    </Card>
  );
}
