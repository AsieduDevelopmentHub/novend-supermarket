"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/hooks/use-permissions";
import { setSessionBackupPassword } from "@/lib/offline/backup-password";
import { BackupPasswordFields, canProtectBackup, canUnlockBackup } from "./backup-password-fields";
import { LocalBackupCard } from "./local-backup-panel";
import { CloudBackupCard } from "./cloud-backup-panel";

/** One Settings place for device and cloud backups, gated by the same password. */
export function BackupsPanel() {
  const { isAdmin } = usePermissions();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const canProtect = canProtectBackup(password, confirm);
  const canUnlock = canUnlockBackup(password);

  // Expose a valid password to the automatic backup_only runner for this session
  // only. Never persisted; cleared when the panel unmounts.
  useEffect(() => {
    setSessionBackupPassword(canProtect ? password : null);
    return () => setSessionBackupPassword(null);
  }, [canProtect, password]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Every backup is encrypted with this password before it leaves the device. Saving a new
            copy requires a strong password and a match. Restoring needs the password that was used
            when that copy was created. The file lists algorithm, salt, and IV so it can be opened
            later — those are not secrets. Only this password protects the data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BackupPasswordFields
            password={password}
            confirm={confirm}
            onPasswordChange={setPassword}
            onConfirmChange={setConfirm}
          />
        </CardContent>
      </Card>

      <LocalBackupCard password={password} canProtect={canProtect} canUnlock={canUnlock} />

      {isAdmin ? (
        <CloudBackupCard password={password} canProtect={canProtect} canUnlock={canUnlock} />
      ) : null}
    </div>
  );
}
