"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/hooks/use-permissions";
import { useLicense } from "@/hooks/use-license";
import { resolveBackupSecret } from "@/lib/offline/recovery-key";
import {
  RecoveryKeyPanel,
  canProtectWithRecovery,
  canUnlockWithRecovery,
} from "./recovery-key-panel";
import { LocalBackupCard } from "./local-backup-panel";
import { LocalFolderBackupCard } from "./local-folder-backup-panel";
import { CloudBackupCard } from "./cloud-backup-panel";

/** One Settings place for recovery key, device backups, and cloud packages. */
export function BackupsPanel() {
  const { isAdmin } = usePermissions();
  const { organizationId } = useLicense();
  const [unlockKey, setUnlockKey] = useState("");
  const [sealed, setSealed] = useState(false);
  const onSealedChange = useCallback((value: boolean) => setSealed(value), []);

  const canProtect = canProtectWithRecovery(sealed, unlockKey);
  const canUnlock = canUnlockWithRecovery(unlockKey, sealed);

  async function resolveSecret(preferTyped = false): Promise<string | null> {
    return resolveBackupSecret({
      organizationId,
      typedKey: unlockKey,
      preferTyped,
    });
  }

  return (
    <div className="space-y-4">
      <RecoveryKeyPanel
        organizationId={organizationId}
        unlockKey={unlockKey}
        onUnlockKeyChange={setUnlockKey}
        onSealedChange={onSealedChange}
      />

      <LocalBackupCard
        canProtect={canProtect}
        canUnlock={canUnlock}
        resolveSecret={resolveSecret}
      />

      {isAdmin ? <LocalFolderBackupCard canProtect={canProtect} /> : null}

      {isAdmin ? (
        <CloudBackupCard
          canProtect={canProtect}
          canUnlock={canUnlock}
          resolveSecret={resolveSecret}
        />
      ) : null}

      {!sealed && !canProtect ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Waiting for a recovery key</CardTitle>
            <CardDescription>
              Create and seal a recovery key above (or paste an existing one) before saving encrypted
              copies.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      ) : null}
    </div>
  );
}
