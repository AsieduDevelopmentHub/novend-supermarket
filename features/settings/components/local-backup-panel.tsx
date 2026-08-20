"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { downloadOfflineBackup, importOfflineBackup, readBackupFile } from "@/lib/offline/backup";
import { toast } from "sonner";
import { showError } from "@/lib/errors";

/** One-click local database backup and restore for Electron / PWA terminals. */
export function LocalBackupPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<File | null>(null);

  async function onExport() {
    setExporting(true);
    try {
      await downloadOfflineBackup();
      toast.success("Backup downloaded");
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
          held carts, and pending sync events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTitle>Device backup</AlertTitle>
          <AlertDescription>
            Backups stay on this device unless you save the file elsewhere. Restore replaces local
            data — sync with care on shared terminals.
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={exporting} onClick={() => void onExport()}>
            <Download className="mr-2 size-4" aria-hidden />
            {exporting ? "Exporting…" : "Download backup"}
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
