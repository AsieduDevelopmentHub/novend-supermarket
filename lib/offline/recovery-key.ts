/**
 * Organization recovery key — set once, sealed on this device for scheduled
 * cloud uploads, typed on a fresh device to restore. Never sent to Convex.
 *
 * Distinct from login passwords: one org-wide secret for encrypting backups and
 * compact snapshots. See docs/architecture/OFFLINE_SYNC.md.
 */

import { isCapacitor, secureStorage } from "@novend/hardware";
import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";

const RECOVERY_KEY_STORAGE_PREFIX = "novend.recoveryKey.";
/** Generated keys are long enough that PBKDF2 work dominates brute force. */
const GENERATED_KEY_BYTES = 24;

function storageKey(organizationId: string): string {
  return `${RECOVERY_KEY_STORAGE_PREFIX}${organizationId}`;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Human-readable groups for copy/save (same secret, easier to store offline). */
export function formatRecoveryKeyForDisplay(key: string): string {
  const compact = key.replace(/\s+/g, "");
  const chunks: string[] = [];
  for (let i = 0; i < compact.length; i += 4) {
    chunks.push(compact.slice(i, i + 4));
  }
  return chunks.join("-");
}

export function normalizeRecoveryKeyInput(value: string): string {
  return value.replace(/[\s-]+/g, "").trim();
}

/** Cryptographically random org recovery key (alphanumeric only). */
export function generateRecoveryKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(GENERATED_KEY_BYTES));
  // Base64url may include `-` / `_`. Remap those so display grouping hyphens
  // (formatRecoveryKeyForDisplay) can be stripped without changing the secret.
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return bytesToBase64Url(bytes).replace(/[-_]/g, () => {
    const pick = crypto.getRandomValues(new Uint8Array(1))[0]! % alphabet.length;
    return alphabet[pick]!;
  });
}

export function isValidRecoveryKey(value: string): boolean {
  const key = normalizeRecoveryKeyInput(value);
  // Generated keys are ~32 chars; allow slightly shorter hand-copied keys that
  // still beat a typical password. Reject login-password length ranges.
  return key.length >= 24 && /^[A-Za-z0-9_-]+$/.test(key);
}

export function assertRecoveryKey(value: string): void {
  if (!isValidRecoveryKey(value)) {
    throw new Error(
      "Enter the full organization recovery key (at least 24 characters, letters and numbers)",
    );
  }
}

async function writeSealedValue(organizationId: string, key: string): Promise<void> {
  const storage = storageKey(organizationId);
  if (isCapacitor()) {
    const result = await secureStorage.set(storage, key);
    if (!result.ok) {
      // Fall through to browser storage when the native vault is unavailable.
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(storage, key);
      }
    }
  } else if (typeof localStorage !== "undefined") {
    localStorage.setItem(storage, key);
  }
  const db = await getOfflineDb();
  if (db) await setMeta(db, META_KEYS.recoveryKeySealed, "1");
}

async function readSealedValue(organizationId: string): Promise<string | null> {
  const storage = storageKey(organizationId);
  if (isCapacitor()) {
    const result = await secureStorage.get(storage);
    if (result.ok && typeof result.data === "string" && result.data.trim()) {
      return normalizeRecoveryKeyInput(result.data);
    }
  }
  if (typeof localStorage !== "undefined") {
    const raw = localStorage.getItem(storage);
    if (raw?.trim()) return normalizeRecoveryKeyInput(raw);
  }
  return null;
}

async function removeSealedValue(organizationId: string): Promise<void> {
  const storage = storageKey(organizationId);
  if (isCapacitor()) {
    await secureStorage.remove(storage);
  }
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(storage);
  }
  const db = await getOfflineDb();
  if (db) await setMeta(db, META_KEYS.recoveryKeySealed, "");
}

/** Seal the recovery key on this device so scheduled uploads can encrypt. */
export async function sealRecoveryKey(organizationId: string, key: string): Promise<void> {
  if (!organizationId.trim()) throw new Error("Organization is required to seal a recovery key");
  const normalized = normalizeRecoveryKeyInput(key);
  assertRecoveryKey(normalized);
  await writeSealedValue(organizationId, normalized);
}

/** Load the sealed key for automatic encryption. Null when not set on this device. */
export async function loadSealedRecoveryKey(organizationId: string): Promise<string | null> {
  if (!organizationId.trim()) return null;
  return await readSealedValue(organizationId);
}

export async function clearSealedRecoveryKey(organizationId: string): Promise<void> {
  if (!organizationId.trim()) return;
  await removeSealedValue(organizationId);
}

export async function hasSealedRecoveryKey(organizationId: string): Promise<boolean> {
  const sealed = await loadSealedRecoveryKey(organizationId);
  if (sealed) return true;
  const db = await getOfflineDb();
  if (!db) return false;
  return (await getMeta(db, META_KEYS.recoveryKeySealed)) === "1";
}

/**
 * Secret used to encrypt/decrypt backups: sealed key if present, otherwise the
 * typed unlock field (fresh device / restore). Prefer sealed for create.
 */
export async function resolveBackupSecret(args: {
  organizationId: string | null | undefined;
  typedKey?: string;
  preferTyped?: boolean;
}): Promise<string | null> {
  const typed = args.typedKey ? normalizeRecoveryKeyInput(args.typedKey) : "";
  if (args.preferTyped && typed) {
    assertRecoveryKey(typed);
    return typed;
  }
  if (args.organizationId) {
    const sealed = await loadSealedRecoveryKey(args.organizationId);
    if (sealed) return sealed;
  }
  if (typed) {
    assertRecoveryKey(typed);
    return typed;
  }
  return null;
}
