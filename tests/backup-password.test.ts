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

const STRONG = "NovendBackup1";

describe("backup password", () => {
  it("rejects short or simple passwords for new backups", () => {
    expect(isStrongBackupPassword("short1A")).toBe(false);
    expect(backupPasswordIssues("short1A").length).toBeGreaterThan(0);
    expect(() => assertBackupPassword("password")).toThrow(/12 characters/);
    expect(() => assertBackupPassword("novendbackup1")).toThrow(/uppercase/);
  });

  it("accepts a 12-character mixed password", () => {
    expect(isStrongBackupPassword(STRONG)).toBe(true);
    expect(() => assertBackupPassword(STRONG)).not.toThrow();
  });

  it("allows unlocking with any non-empty password", () => {
    expect(() => assertBackupUnlockPassword("")).toThrow(/Enter the backup password/);
    expect(() => assertBackupUnlockPassword("   ")).toThrow(/Enter the backup password/);
    expect(() => assertBackupUnlockPassword("old-eight")).not.toThrow();
  });
});

describe("backup payload", () => {
  it("refuses unencrypted JSON backups", async () => {
    await expect(
      parseBackupPayload(JSON.stringify({ version: 2, tables: {} }), STRONG),
    ).rejects.toThrow(/not password-protected/);
  });

  it("round-trips an encrypted backup", async () => {
    const payload: OfflineBackupPayload = {
      version: 2,
      exportedAt: 1,
      tables: { meta: [] },
    };
    const envelope = await encryptOfflineBackup(payload, STRONG);
    expect(envelope.kdf.salt).toBeTruthy();
    expect(envelope.cipher.iv).toBeTruthy();
    const compact = JSON.stringify(envelope);
    expect(compact).not.toMatch(/\n\s+/);
    const restored = await parseBackupPayload(compact, STRONG);
    expect(restored.version).toBe(2);
    expect(restored.tables.meta).toEqual([]);
  });
});
