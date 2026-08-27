"use client";

import { Check, Circle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  BACKUP_PASSWORD_REQUIREMENTS,
  backupPasswordIssues,
  isStrongBackupPassword,
} from "@/lib/offline/backup-password";
import { cn } from "@/lib/utils";

type BackupPasswordFieldsProps = {
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
};

export function canProtectBackup(password: string, confirm: string): boolean {
  return isStrongBackupPassword(password) && password === confirm;
}

export function canUnlockBackup(password: string): boolean {
  return password.trim().length > 0;
}

/** Shared password gate for local and cloud backup actions. */
export function BackupPasswordFields({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
}: BackupPasswordFieldsProps) {
  const issues = backupPasswordIssues(password);
  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="backup-password">Backup password</Label>
        <PasswordInput
          id="backup-password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          autoComplete="new-password"
          required
          minLength={12}
          aria-describedby="backup-password-rules"
          aria-invalid={password.length > 0 && issues.length > 0}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="backup-password-confirm">Confirm password</Label>
        <PasswordInput
          id="backup-password-confirm"
          value={confirm}
          onChange={(event) => onConfirmChange(event.target.value)}
          autoComplete="new-password"
          required
          minLength={12}
          aria-invalid={mismatch}
        />
        {mismatch ? <p className="text-destructive text-xs">Passwords do not match.</p> : null}
      </div>
      <ul id="backup-password-rules" className="space-y-1">
        {BACKUP_PASSWORD_REQUIREMENTS.map((rule) => {
          const met = !issues.includes(rule.label);
          return (
            <li
              key={rule.id}
              className={cn(
                "flex items-center gap-2 text-xs",
                met && password.length > 0 ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {met && password.length > 0 ? (
                <Check className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <Circle className="size-3.5 shrink-0" aria-hidden />
              )}
              {rule.label}
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground text-xs">
        Required to save or restore any backup. Novend cannot recover this password — store it in
        your organization&apos;s password manager.
      </p>
    </div>
  );
}
