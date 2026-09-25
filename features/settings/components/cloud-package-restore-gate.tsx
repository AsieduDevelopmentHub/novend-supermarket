"use client";

import { useEffect, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { HardDrive } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { importOfflineBackup, parseBackupPayload } from "@/lib/offline/backup";
import { needsCloudPackageRestore } from "@/lib/offline/needs-cloud-restore";
import {
  isValidRecoveryKey,
  normalizeRecoveryKeyInput,
  sealRecoveryKey,
} from "@/lib/offline/recovery-key";
import { showError } from "@/lib/errors";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useLicense } from "@/hooks/use-license";
import { usePermissions } from "@/hooks/use-permissions";

/**
 * After login on backup_only / snapshot_only, prompt an admin to restore the
 * latest cloud package when Dexie has no usable org data.
 */
export function CloudPackageRestoreGate() {
  const online = useConnectivity();
  const { isAdmin } = usePermissions();
  const { cloudMode, organizationId } = useLicense();
  const convex = useConvex();
  const usage = useQuery(
    api.cloudBackups.usage,
    online && isAdmin && (cloudMode === "backup_only" || cloudMode === "snapshot_only")
      ? {}
      : "skip",
  );

  const [needed, setNeeded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [key, setKey] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (cloudMode !== "backup_only" && cloudMode !== "snapshot_only") {
      setNeeded(false);
      return;
    }
    let cancelled = false;
    void needsCloudPackageRestore().then((value) => {
      if (!cancelled) setNeeded(value);
    });
    return () => {
      cancelled = true;
    };
  }, [cloudMode, organizationId]);

  const latest = usage?.backups[0];
  const open =
    online &&
    isAdmin &&
    needed &&
    !dismissed &&
    (cloudMode === "backup_only" || cloudMode === "snapshot_only") &&
    Boolean(latest);

  async function onRestore() {
    if (!latest || !organizationId) return;
    const secret = normalizeRecoveryKeyInput(key);
    if (!isValidRecoveryKey(secret)) {
      toast.error("Enter the full organization recovery key");
      return;
    }
    setPending(true);
    try {
      const url = await convex.query(api.cloudBackups.backupDownloadUrl, {
        backupId: latest.id as Id<"cloudBackups">,
      });
      if (!url) throw new Error("That cloud package is no longer available");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not download the cloud package");
      const payload = await parseBackupPayload(await response.text(), secret);
      await importOfflineBackup(payload);
      await sealRecoveryKey(organizationId, secret);
      toast.success("Cloud package restored");
      window.location.reload();
    } catch (error) {
      showError(error, "Could not restore the cloud package");
    } finally {
      setPending(false);
    }
  }

  if (!open || !latest) return null;

  return (
    <Dialog open onOpenChange={(next) => !next && setDismissed(true)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-4 w-4" aria-hidden />
            Restore this organization
          </DialogTitle>
          <DialogDescription>
            This device has no local business data. Restore the latest cloud package (
            {latest.fileName}) with the organization recovery key to continue selling from the last
            upload. Sales after that upload are not included.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="restore-gate-key">Organization recovery key</Label>
          <PasswordInput
            id="restore-gate-key"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setDismissed(true)}
          >
            Skip for now
          </Button>
          <Button
            type="button"
            disabled={pending || !isValidRecoveryKey(key)}
            onClick={() => void onRestore()}
          >
            {pending ? "Restoring…" : "Restore and continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
