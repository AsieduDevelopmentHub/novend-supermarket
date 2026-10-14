"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderOpen, HardDrive, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { isElectron } from "@novend/hardware";
import { showError } from "@/lib/errors";
import {
  LOCAL_BACKUP_INTERVAL_OPTIONS,
  loadLocalFolderBackupSettings,
  maybeRunLocalFolderBackup,
  openLocalBackupFolder,
  pickLocalBackupFolder,
  setLocalFolderBackupEnabled,
  setLocalFolderBackupIntervalHours,
  type LocalFolderBackupSettings,
} from "@/lib/offline/local-folder-backup";
import { toast } from "sonner";

type Props = {
  canProtect: boolean;
};

function formatWhen(at: number | null) {
  if (!at) return "Never";
  return new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Automatic encrypted backups to a folder on this PC (desktop) or Documents (mobile). */
export function LocalFolderBackupCard({ canProtect }: Props) {
  const [settings, setSettings] = useState<LocalFolderBackupSettings | null>(null);
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async () => {
    setSettings(await loadLocalFolderBackupSettings());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onToggle(enabled: boolean) {
    await setLocalFolderBackupEnabled(enabled);
    await refresh();
  }

  async function onInterval(value: string) {
    await setLocalFolderBackupIntervalHours(Number(value));
    await refresh();
  }

  async function onChangeFolder() {
    try {
      const path = await pickLocalBackupFolder();
      if (path) {
        toast.success("Backup folder updated");
        await refresh();
      }
    } catch (error) {
      showError(error, "Could not change backup folder");
    }
  }

  async function onOpenFolder() {
    try {
      await openLocalBackupFolder();
    } catch (error) {
      showError(error, "Could not open backup folder");
    }
  }

  async function onRunNow() {
    if (!canProtect) return;
    setPending(true);
    try {
      const ok = await maybeRunLocalFolderBackup({ force: true });
      if (!ok) {
        throw new Error(
          "Backup did not run. Seal a recovery key, confirm the folder, and use the desktop or mobile app.",
        );
      }
      toast.success("Backup saved to the folder");
      await refresh();
    } catch (error) {
      showError(error, "Could not run backup");
    } finally {
      setPending(false);
    }
  }

  const folderLabel = settings?.folderPath ?? "Not set";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automatic folder backup</CardTitle>
        <CardDescription>
          Writes a full encrypted <code className="text-xs">.novend-backup</code> on a schedule —
          same format as Novend POS. Restore on a new Millie&apos;s till or in Novend Settings →
          Backups with this store&apos;s recovery key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <Label htmlFor="local-backup-enabled">Enable automatic backups</Label>
            <p className="text-muted-foreground text-xs">
              Uses the sealed recovery key. Interval matches Novend (12 hours–30 days).
            </p>
          </div>
          <Switch
            id="local-backup-enabled"
            checked={settings?.enabled ?? true}
            disabled={!settings}
            onCheckedChange={(checked) => void onToggle(checked)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="local-backup-interval">Backup interval</Label>
          <Select
            value={String(settings?.intervalHours ?? 24)}
            disabled={!settings}
            onValueChange={(value) => void onInterval(value)}
          >
            <SelectTrigger id="local-backup-interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCAL_BACKUP_INTERVAL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Backup folder</Label>
          <div className="border-border bg-muted/40 flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm break-all" title={folderLabel}>
              <HardDrive className="mr-2 inline size-4 align-text-bottom" aria-hidden />
              {folderLabel}
            </p>
            <div className="flex flex-wrap gap-2">
              {settings?.folderSelectable ? (
                <Button type="button" size="sm" variant="outline" onClick={() => void onChangeFolder()}>
                  Change folder
                </Button>
              ) : null}
              {isElectron() || settings?.folderPath ? (
                <Button type="button" size="sm" variant="outline" onClick={() => void onOpenFolder()}>
                  <FolderOpen className="mr-1 size-4" aria-hidden />
                  Open
                </Button>
              ) : null}
            </div>
          </div>
          {!isElectron() ? (
            <p className="text-muted-foreground text-xs">
              Folder selection is available in the desktop app. On mobile, files go to Documents. In a
              browser, use &quot;Download file&quot; on This device instead.
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Default is Documents/Millies-Supermarket-Backups. Change it to a USB drive or shared
              folder if you prefer.
            </p>
          )}
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>Last automatic backup: {formatWhen(settings?.lastBackupAt ?? null)}</p>
          <Button
            type="button"
            size="sm"
            disabled={pending || !canProtect || !(settings?.enabled ?? true)}
            onClick={() => void onRunNow()}
          >
            <RefreshCw className="mr-1 size-4" aria-hidden />
            {pending ? "Saving…" : "Backup now"}
          </Button>
        </div>
        {!canProtect ? (
          <p className="text-muted-foreground text-xs">
            Seal a recovery key above before automatic backups can run.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
