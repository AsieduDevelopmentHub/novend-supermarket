import { describe, expect, it } from "vitest";
import {
  assertBackupPassword,
  assertBackupUnlockPassword,
  backupPasswordIssues,
  isStrongBackupPassword,
} from "@/lib/offline/backup-password";
import {
  encryptOfflineBackup,
  parseBackupPayload,
  type OfflineBackupPayload,
} from "@/lib/offline/backup";
import {
  formatRecoveryKeyForDisplay,
  generateRecoveryKey,
  isValidRecoveryKey,
  normalizeRecoveryKeyInput,
} from "@/lib/offline/recovery-key";

const STRONG = "NovendBackup1";

describe("backup password", () => {
  it("rejects short or simple passwords for new backups", () => {
    expect(isStrongBackupPassword("short1A")).toBe(false);
    expect(backupPasswordIssues("short1A").length).toBeGreaterThan(0);
    expect(() => assertBackupPassword("password")).toThrow(/recovery key/);
    expect(() => assertBackupPassword("novendbackup1")).toThrow(/recovery key/);
  });

  it("accepts a 12-character mixed password", () => {
    expect(isStrongBackupPassword(STRONG)).toBe(true);
    expect(() => assertBackupPassword(STRONG)).not.toThrow();
  });

  it("accepts a generated recovery key as the protect secret", () => {
    const key = generateRecoveryKey();
    expect(isValidRecoveryKey(key)).toBe(true);
    expect(isStrongBackupPassword(key)).toBe(true);
    expect(() => assertBackupPassword(key)).not.toThrow();
  });

  it("allows unlocking with any non-empty password", () => {
    expect(() => assertBackupUnlockPassword("")).toThrow(/recovery key/);
    expect(() => assertBackupUnlockPassword("   ")).toThrow(/recovery key/);
    expect(() => assertBackupUnlockPassword("old-eight")).not.toThrow();
  });
});

describe("recovery key formatting", () => {
  it("normalizes hyphens and spaces", () => {
    const key = generateRecoveryKey();
    const displayed = formatRecoveryKeyForDisplay(key);
    expect(normalizeRecoveryKeyInput(displayed)).toBe(key);
    expect(isValidRecoveryKey(displayed)).toBe(true);
  });
});

describe("backup payload", () => {
  it("refuses unencrypted JSON backups", async () => {
    await expect(
      parseBackupPayload(JSON.stringify({ version: 2, tables: {} }), STRONG),
    ).rejects.toThrow(/not encrypted/);
  });

  it("round-trips an encrypted backup with a recovery key", async () => {
    const key = generateRecoveryKey();
    const payload: OfflineBackupPayload = {
      version: 2,
      exportedAt: 1,
      tables: { meta: [] },
      snapshotVersion: 1,
    };
    const envelope = await encryptOfflineBackup(payload, key);
    expect(envelope.kdf.salt).toBeTruthy();
    expect(envelope.cipher.iv).toBeTruthy();
    const compact = JSON.stringify(envelope);
    expect(compact).not.toMatch(/\n\s+/);
    const restored = await parseBackupPayload(compact, formatRecoveryKeyForDisplay(key));
    expect(restored.version).toBe(2);
    expect(restored.tables.meta).toEqual([]);
    expect(restored.snapshotVersion).toBe(1);
  });
});
