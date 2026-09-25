"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import {
  downloadOfflineBackup,
  estimateBackupSize,
  getLastBackupAt,
  importOfflineBackup,
  readBackupFile,
} from "@/lib/offline/backup";
import { useNativeShell } from "@/hooks/use-native-shell";
import { toast } from "sonner";
import { showError } from "@/lib/errors";

type LocalBackupCardProps = {
  canProtect: boolean;
  canUnlock: boolean;
  resolveSecret: (preferTyped?: boolean) => Promise<string | null>;
};

/** Device-local encrypted backup — save a file or restore one. */
export function LocalBackupCard({ canProtect, canUnlock, resolveSecret }: LocalBackupCardProps) {
  const nativeShell = useNativeShell();
  const inputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<File | null>(null);
  const [sizeLabel, setSizeLabel] = useState<string>("—");
  const [lastBackupLabel, setLastBackupLabel] = useState<string>("Never");

  useEffect(() => {
    void (async () => {
      try {
        const bytes = await estimateBackupSize();
        const mb = bytes / (1024 * 1024);
        setSizeLabel(mb < 0.1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`);
      } catch {
        setSizeLabel("Unavailable");
      }
      const last = await getLastBackupAt();
      setLastBackupLabel(
        last
          ? new Date(last).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
          : "Never",
      );
    })();
  }, []);

  async function onExport() {
    if (!canProtect) return;
    setExporting(true);
    try {
      const secret = await resolveSecret();
      if (!secret) throw new Error("Seal or enter the organization recovery key first");
      await downloadOfflineBackup(secret);
      const last = await getLastBackupAt();
      setLastBackupLabel(
        last
          ? new Date(last).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
          : "Just now",
      );
      toast.success(nativeShell ? "Backup saved to Documents" : "Backup downloaded");
    } catch (error) {
      showError(error, "Could not export backup");
    } finally {
      setExporting(false);
    }
  }

  async function onRestore(file: File) {
    if (!canUnlock) return;
    setImporting(true);
    try {
      const secret = await resolveSecret(true);
      if (!secret) throw new Error("Enter the recovery key that encrypted this file");
      const payload = await readBackupFile(file, secret);
      await importOfflineBackup(payload);
      toast.success("Backup restored — reload to refresh all views");
    } catch (error) {
      showError(error, "Could not restore backup");
    } finally {
      setImporting(false);
      setConfirmRestore(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>This device</CardTitle>
        <CardDescription>
          Encrypted copy of this terminal&apos;s offline database — sales, inventory mirror, held
          carts, and pending sync. Product image blobs are excluded to keep files small.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-2">
          <p>Estimated size: {sizeLabel}</p>
          <p>Last local backup: {lastBackupLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={exporting || !canProtect} onClick={() => void onExport()}>
            <Download className="mr-2 size-4" aria-hidden />
            {exporting ? "Saving…" : nativeShell ? "Save to this device" : "Download file"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={importing || !canUnlock}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-2 size-4" aria-hidden />
            Restore from file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".novend-backup,application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) setConfirmRestore(file);
            }}
          />
        </div>
        {!canProtect ? (
          <p className="text-muted-foreground text-xs">
            Seal a recovery key above before saving. Restore needs the key that encrypted the file.
          </p>
        ) : null}
      </CardContent>
      <ConfirmDialog
        open={Boolean(confirmRestore)}
        onOpenChange={(open) => {
          if (!open) setConfirmRestore(null);
        }}
        title="Restore this backup?"
        description="This replaces all offline data on this device with the backup file. Unsynced changes may be lost."
        confirmLabel={importing ? "Restoring…" : "Restore"}
        confirmVariant="default"
        pending={importing}
        disableConfirm={!canUnlock}
        onConfirm={() => {
          if (confirmRestore) void onRestore(confirmRestore);
        }}
      />
    </Card>
  );
}
