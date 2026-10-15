"use client";

import { useEffect, useState } from "react";
import { Check, Circle, Copy, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { showError } from "@/lib/errors";
import {
  formatRecoveryKeyForDisplay,
  generateRecoveryKey,
  hasSealedRecoveryKey,
  isValidRecoveryKey,
  normalizeRecoveryKeyInput,
  sealRecoveryKey,
  clearSealedRecoveryKey,
} from "@/lib/offline/recovery-key";
import { cn } from "@/lib/utils";

type RecoveryKeyPanelProps = {
  organizationId: string | null;
  unlockKey: string;
  onUnlockKeyChange: (value: string) => void;
  onSealedChange: (sealed: boolean) => void;
};

/** Create / rotate the org recovery key and unlock restore with a typed key. */
export function RecoveryKeyPanel({
  organizationId,
  unlockKey,
  onUnlockKeyChange,
  onSealedChange,
}: RecoveryKeyPanelProps) {
  const [sealed, setSealed] = useState(false);
  const [pending, setPending] = useState(false);
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [confirmSaved, setConfirmSaved] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!organizationId) {
        if (!cancelled) {
          setSealed(false);
          onSealedChange(false);
        }
        return;
      }
      const present = await hasSealedRecoveryKey(organizationId);
      if (!cancelled) {
        setSealed(present);
        onSealedChange(present);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, onSealedChange]);

  async function sealAndRemember(key: string) {
    if (!organizationId) {
      toast.error("Sign in to an organization before setting a recovery key");
      return;
    }
    setPending(true);
    try {
      await sealRecoveryKey(organizationId, key);
      setSealed(true);
      onSealedChange(true);
      setDraftKey(null);
      setConfirmSaved(false);
      toast.success("Recovery key saved on this device");
    } catch (error) {
      showError(error, "Could not save recovery key");
    } finally {
      setPending(false);
    }
  }

  function startCreate() {
    // Defer so Cap can paint the button press before crypto + UI swap.
    setPending(true);
    window.setTimeout(() => {
      try {
        const key = generateRecoveryKey();
        setDraftKey(key);
        setConfirmSaved(false);
      } finally {
        setPending(false);
      }
    }, 0);
  }

  async function copyDraft() {
    if (!draftKey) return;
    try {
      await navigator.clipboard.writeText(formatRecoveryKeyForDisplay(draftKey));
      toast.success("Recovery key copied");
    } catch {
      toast.error("Could not copy — select and save the key manually");
    }
  }

  async function onRotateConfirm() {
    if (!organizationId) return;
    setPending(true);
    try {
      await clearSealedRecoveryKey(organizationId);
      setSealed(false);
      onSealedChange(false);
      setConfirmRotate(false);
      startCreate();
    } catch (error) {
      showError(error, "Could not clear the previous recovery key");
    } finally {
      setPending(false);
    }
  }

  const canUnlock = isValidRecoveryKey(unlockKey);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" aria-hidden />
          Recovery key
        </CardTitle>
        <CardDescription>
          One key encrypts local backups on this till. Set it once so folder backups can run without
          retyping. Store a copy offline — Novend cannot recover it. Login passwords are never used.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {draftKey ? (
          <div className="border-border space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Save this key now — it will not be shown again</p>
            <p className="bg-muted rounded-md p-3 font-mono text-sm leading-relaxed break-all">
              {formatRecoveryKeyForDisplay(draftKey)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void copyDraft()}>
                <Copy className="mr-2 size-4" aria-hidden />
                Copy
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmSaved((value) => !value)}
              >
                {confirmSaved ? (
                  <Check className="mr-2 size-4" aria-hidden />
                ) : (
                  <Circle className="mr-2 size-4" aria-hidden />
                )}
                I saved a copy
              </Button>
              <Button
                type="button"
                disabled={!confirmSaved || pending}
                onClick={() => void sealAndRemember(draftKey)}
              >
                {pending ? "Saving…" : "Seal on this device"}
              </Button>
            </div>
          </div>
        ) : sealed ? (
          <div className="space-y-3">
            <p className="text-foreground text-sm">
              A recovery key is sealed on this device. Local folder backups can encrypt without
              opening Settings.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={pending || !organizationId}
              onClick={() => setConfirmRotate(true)}
            >
              <RefreshCw className="mr-2 size-4" aria-hidden />
              Rotate recovery key
            </Button>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Rotating only affects new uploads. Older backups still need the previous key.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              No recovery key on this device yet. Create one before encrypted local backups can run.
            </p>
            <Button type="button" disabled={!organizationId || pending} onClick={startCreate}>
              {pending ? "Creating…" : "Create recovery key"}
            </Button>
          </div>
        )}

        <div className="border-border space-y-2 border-t pt-4">
          <Label htmlFor="recovery-key-unlock">Unlock / restore key</Label>
          <PasswordInput
            id="recovery-key-unlock"
            value={unlockKey}
            onChange={(event) => onUnlockKeyChange(event.target.value)}
            autoComplete="off"
            placeholder="Paste recovery key to restore a package"
            aria-invalid={unlockKey.length > 0 && !canUnlock}
          />
          <p className={cn("text-xs", canUnlock ? "text-foreground" : "text-muted-foreground")}>
            Required to restore a file backup on this device. Hyphens and spaces are ignored.
          </p>
          {organizationId && isValidRecoveryKey(unlockKey) && !sealed ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => void sealAndRemember(normalizeRecoveryKeyInput(unlockKey))}
            >
              Seal this key on this device
            </Button>
          ) : null}
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title="Rotate recovery key?"
        description="This device forgets the current key. New backups use the next key. Older backup files still need the previous key to restore."
        confirmLabel={pending ? "Working…" : "Rotate"}
        confirmVariant="destructive"
        pending={pending}
        onConfirm={() => void onRotateConfirm()}
      />
    </Card>
  );
}

export function canProtectWithRecovery(sealed: boolean, typedKey: string): boolean {
  return sealed || isValidRecoveryKey(typedKey);
}

export function canUnlockWithRecovery(typedKey: string, sealed: boolean): boolean {
  return sealed || isValidRecoveryKey(typedKey);
}
