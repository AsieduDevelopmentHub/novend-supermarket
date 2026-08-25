import { brandedDocumentName } from "@/lib/export-filenames";
import { getOfflineDb } from "./db";
import { Hardware, isCapacitor } from "@novend/hardware";

const TABLE_NAMES = [
  "meta",
  "products",
  "branchStock",
  "categories",
  "customers",
  "orders",
  "orderItems",
  "heldSales",
  "localSales",
  "localSaleItems",
  "localReceipts",
  "localReturns",
  "localReturnItems",
  "suppliers",
  "wholesaleStock",
  "wholesalePurchases",
  "wholesaleTransfers",
  "branches",
  "users",
  "expenses",
  "returns",
  "outbox",
] as const;

const BACKUP_VERSION = 2;
const SUPPORTED_VERSIONS = new Set([1, 2]);
const LAST_BACKUP_KEY = "novend.backup.lastAt";
const ENCRYPTED_BACKUP_FORMAT = "novend-encrypted-backup";
const BACKUP_KDF_ITERATIONS = 310_000;

export type OfflineBackupPayload = {
  version: number;
  exportedAt: number;
  organizationId?: string;
  userId?: string;
  tables: Record<string, unknown[]>;
};

type EncryptedBackupEnvelope = {
  format: typeof ENCRYPTED_BACKUP_FORMAT;
  version: 1;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string };
  cipher: { name: "AES-GCM"; iv: string };
  ciphertext: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  return new Uint8Array(Array.from(binary, (char) => char.charCodeAt(0)));
}

async function deriveBackupKey(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
  if (passphrase.length < 8) throw new Error("Backup password must be at least 8 characters");
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: BACKUP_KDF_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptOfflineBackup(
  payload: OfflineBackupPayload,
  passphrase: string,
): Promise<EncryptedBackupEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: 1,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: BACKUP_KDF_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    cipher: { name: "AES-GCM", iv: bytesToBase64(iv) },
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

async function decryptOfflineBackup(
  envelope: EncryptedBackupEnvelope,
  passphrase: string,
): Promise<OfflineBackupPayload> {
  try {
    const salt = base64ToBytes(envelope.kdf.salt);
    const iv = base64ToBytes(envelope.cipher.iv);
    const key = await deriveBackupKey(passphrase, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      base64ToBytes(envelope.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as OfflineBackupPayload;
  } catch {
    throw new Error("Backup password is incorrect or the file is damaged");
  }
}

/** Export all Dexie tables to a portable JSON backup (excludes product image blobs). */
export async function exportOfflineBackup(): Promise<OfflineBackupPayload> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local database is not available on this device");

  const tables: Record<string, unknown[]> = {};
  for (const name of TABLE_NAMES) {
    try {
      tables[name] = await db.table(name).toArray();
    } catch {
      tables[name] = [];
    }
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    organizationId: typeof window !== "undefined" ? window.localStorage.getItem("novend.offlineOrganizationId") ?? undefined : undefined,
    userId: typeof window !== "undefined" ? window.localStorage.getItem("novend.offlineUserId") ?? undefined : undefined,
    tables,
  };
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function rememberBackupTime(exportedAt: number) {
  try {
    if (isCapacitor()) {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: LAST_BACKUP_KEY, value: String(exportedAt) });
    } else if (typeof localStorage !== "undefined") {
      localStorage.setItem(LAST_BACKUP_KEY, String(exportedAt));
    }
  } catch {
    /* ignore */
  }
}

export async function getLastBackupAt(): Promise<number | null> {
  try {
    if (isCapacitor()) {
      const { Preferences } = await import("@capacitor/preferences");
      const stored = await Preferences.get({ key: LAST_BACKUP_KEY });
      return stored.value ? Number(stored.value) : null;
    }
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(LAST_BACKUP_KEY);
      return raw ? Number(raw) : null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function estimateBackupSize(): Promise<number> {
  const payload = await exportOfflineBackup();
  return new Blob([JSON.stringify(payload)]).size;
}

export async function downloadOfflineBackup(passphrase: string) {
  const payload = await exportOfflineBackup();
  const encrypted = await encryptOfflineBackup(payload, passphrase);
  const stamp = new Date(payload.exportedAt).toISOString().slice(0, 10);
  const filename = brandedDocumentName("Offline-Backup", stamp, "novend-backup");

  if (isCapacitor()) {
    const text = JSON.stringify(encrypted);
    const bytes = new TextEncoder().encode(text);
    const saved = await Hardware.filesystem.saveImage(bytes, filename);
    if (!saved.ok) throw new Error(saved.message || "Could not save backup");
  } else {
    downloadJson(filename, encrypted);
  }

  await rememberBackupTime(payload.exportedAt);
  return payload;
}

/** Replace local Dexie contents from a backup file. */
export async function importOfflineBackup(payload: OfflineBackupPayload) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local database is not available on this device");
  if (!SUPPORTED_VERSIONS.has(payload.version)) {
    throw new Error("Unsupported backup version");
  }
  const currentOrganization = typeof window !== "undefined" ? window.localStorage.getItem("novend.offlineOrganizationId") : null;
  if (payload.organizationId && currentOrganization && payload.organizationId !== currentOrganization) {
    throw new Error("This backup belongs to a different organization");
  }

  await db.transaction("rw", [...TABLE_NAMES], async () => {
    for (const name of TABLE_NAMES) {
      const rows = payload.tables[name];
      const table = db.table(name);
      await table.clear();
      if (Array.isArray(rows) && rows.length > 0) {
        await table.bulkPut(rows);
      }
    }
  });
}

export async function readBackupFile(file: File, passphrase: string): Promise<OfflineBackupPayload> {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  if (
    parsed &&
    typeof parsed === "object" &&
    "format" in parsed &&
    parsed.format === ENCRYPTED_BACKUP_FORMAT
  ) {
    return await decryptOfflineBackup(parsed as EncryptedBackupEnvelope, passphrase);
  }
  if (!parsed || typeof parsed !== "object" || !("tables" in parsed)) {
    throw new Error("Invalid backup file");
  }
  return parsed as OfflineBackupPayload;
}
