/**
 * Rules for encrypting backups.
 *
 * New uploads prefer the organization recovery key (see recovery-key.ts). Legacy
 * strong passwords remain valid so older files and transitional UI still work.
 * Unlocking only requires a non-empty secret.
 */

import { isValidRecoveryKey, normalizeRecoveryKeyInput } from "./recovery-key";

export const BACKUP_PASSWORD_MIN_LENGTH = 12;

export const BACKUP_PASSWORD_REQUIREMENTS = [
  { id: "length", label: `At least ${BACKUP_PASSWORD_MIN_LENGTH} characters` },
  { id: "upper", label: "An uppercase letter" },
  { id: "lower", label: "A lowercase letter" },
  { id: "digit", label: "A number" },
] as const;

export function backupPasswordIssues(password: string): string[] {
  if (isValidRecoveryKey(password)) return [];
  const issues: string[] = [];
  if (password.length < BACKUP_PASSWORD_MIN_LENGTH) {
    issues.push(BACKUP_PASSWORD_REQUIREMENTS[0].label);
  }
  if (!/[A-Z]/.test(password)) issues.push(BACKUP_PASSWORD_REQUIREMENTS[1].label);
  if (!/[a-z]/.test(password)) issues.push(BACKUP_PASSWORD_REQUIREMENTS[2].label);
  if (!/\d/.test(password)) issues.push(BACKUP_PASSWORD_REQUIREMENTS[3].label);
  return issues;
}

export function isStrongBackupPassword(password: string): boolean {
  return backupPasswordIssues(password).length === 0;
}

/** Required before creating (local save or cloud upload) a backup. */
export function assertBackupPassword(password: string): void {
  const normalized = normalizeRecoveryKeyInput(password);
  if (isValidRecoveryKey(normalized)) return;
  const issues = backupPasswordIssues(password);
  if (issues.length > 0) {
    throw new Error(
      `Use the organization recovery key, or a password of at least ${BACKUP_PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, and a number`,
    );
  }
}

/** Required before decrypting. Does not raise complexity so older backups still open. */
export function assertBackupUnlockPassword(password: string): void {
  if (!normalizeRecoveryKeyInput(password)) {
    throw new Error("Enter the recovery key (or backup password) to restore");
  }
}
