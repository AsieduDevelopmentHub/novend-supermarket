"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

/** One-click local database backup and restore for Electron / PWA / Capacitor. */
export function LocalBackupPanel() {
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
        last ? new Date(last).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never",
      );
    })();
  }, []);

  async function onExport() {
    setExporting(true);
    try {
      await downloadOfflineBackup();
      const last = await getLastBackupAt();
      setLastBackupLabel(
        last ? new Date(last).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Just now",
      );
      toast.success(nativeShell ? "Backup saved to Documents" : "Backup downloaded");
    } catch (error) {
      showError(error, "Could not export backup");
    } finally {
      setExporting(false);
    }
  }

  async function onRestore(file: File) {
    setImporting(true);
    try {
      const payload = await readBackupFile(file);
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
        <CardTitle>Local backup</CardTitle>
        <CardDescription>
          Export or restore this terminal&apos;s offline database — sales, inventory mirror,
          held carts, and pending sync events. Product image blobs are excluded to keep backups
          small.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTitle>Device backup</AlertTitle>
          <AlertDescription>
            {nativeShell
              ? "Backups save to Documents on this phone and can be shared. Restore replaces local data — sync with care on shared terminals."
              : "Backups stay on this device unless you save the file elsewhere. Restore replaces local data — sync with care on shared terminals."}
          </AlertDescription>
        </Alert>
        <div className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-2">
          <p>Estimated size: {sizeLabel}</p>
          <p>Last backup: {lastBackupLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={exporting} onClick={() => void onExport()}>
            <Download className="mr-2 size-4" aria-hidden />
            {exporting ? "Exporting…" : nativeShell ? "Save backup" : "Download backup"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={importing}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-2 size-4" aria-hidden />
            Restore backup
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) setConfirmRestore(file);
            }}
          />
        </div>
      </CardContent>
      <ConfirmDialog
        open={Boolean(confirmRestore)}
        onOpenChange={(open) => {
          if (!open) setConfirmRestore(null);
        }}
        title="Restore local backup?"
        description="This replaces all offline data on this device with the backup file. Unsynced changes may be lost."
        confirmLabel={importing ? "Restoring…" : "Restore"}
        onConfirm={() => {
          if (confirmRestore) void onRestore(confirmRestore);
        }}
      />
    </Card>
  );
}
