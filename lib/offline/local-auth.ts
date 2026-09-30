/**
 * Device-local password verifier for offline sign-in on Cap/Electron tills.
 *
 * After a successful online password login we store a PBKDF2 digest keyed by
 * email. Offline `/login` checks email + password against that digest, then
 * activates the remembered offline session — no Convex round-trip.
 *
 * This is till custody (device unlock), not a replacement for Convex Auth.
 * Digests never leave the device; plaintext passwords are never persisted.
 */

import {
  clearDeviceAuthVerifiers,
  deleteDeviceAuthVerifier,
  readDeviceAuthVerifier,
  requestPersistentDeviceStorage,
  saveDeviceAuthVerifier,
} from "./device-auth-store";

const STORAGE_PREFIX = "novend.localAuth.v1.";
const ITERATIONS = 120_000;
const HASH_BYTES = 32;

type StoredVerifier = {
  v: 1;
  userId: string;
  salt: string;
  hash: string;
  iterations: number;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function storageKey(email: string): string {
  return `${STORAGE_PREFIX}${normalizeEmail(email)}`;
}

function bufferToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveHash(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as BufferSource,
      iterations,
    },
    material,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** Persist a verifier after a successful online password sign-in. */
export async function storeLocalAuthVerifier(
  email: string,
  password: string,
  userId: string,
): Promise<boolean> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return false;
  const normalized = normalizeEmail(email);
  if (!normalized || !password || !userId) return false;

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(password, salt, ITERATIONS);
  const payload: StoredVerifier = {
    v: 1,
    userId,
    salt: bufferToBase64(salt),
    hash: bufferToBase64(hash),
    iterations: ITERATIONS,
  };
  let saved = false;
  try {
    window.localStorage.setItem(storageKey(normalized), JSON.stringify(payload));
    saved = true;
  } catch {
    /* private mode / quota */
  }
  const durableSaved = await saveDeviceAuthVerifier({ email: normalized, ...payload });
  void requestPersistentDeviceStorage();
  return saved || durableSaved;
}

export type LocalAuthMatch = {
  userId: string;
  email: string;
};

/** Verify email + password against the device digest. Null when missing or wrong. */
export async function verifyLocalAuth(
  email: string,
  password: string,
): Promise<LocalAuthMatch | null> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return null;
  const normalized = normalizeEmail(email);
  if (!normalized || !password) return null;

  let stored: StoredVerifier | null = null;
  try {
    const raw = window.localStorage.getItem(storageKey(normalized));
    if (raw) stored = JSON.parse(raw) as StoredVerifier;
  } catch {
    stored = null;
  }

  if (!stored) {
    const durable = await readDeviceAuthVerifier(normalized);
    if (durable) {
      stored = durable;
      try {
        const payload: StoredVerifier = {
          v: durable.v,
          userId: durable.userId,
          salt: durable.salt,
          hash: durable.hash,
          iterations: durable.iterations,
        };
        window.localStorage.setItem(storageKey(normalized), JSON.stringify(payload));
      } catch {
        /* IndexedDB remains authoritative on this device. */
      }
    }
  }
  if (!stored || stored.v !== 1 || !stored.userId || !stored.salt || !stored.hash) return null;

  try {
    const salt = base64ToBytes(stored.salt);
    const expected = base64ToBytes(stored.hash);
    const actual = await deriveHash(password, salt, stored.iterations || ITERATIONS);
    if (!timingSafeEqual(actual, expected)) return null;
    return { userId: stored.userId, email: normalized };
  } catch {
    return null;
  }
}

export function hasLocalAuthVerifier(email: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage.getItem(storageKey(email)));
  } catch {
    return false;
  }
}

export async function clearLocalAuthVerifier(email?: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (email) {
    try {
      window.localStorage.removeItem(storageKey(email));
    } catch {
      /* IndexedDB deletion below remains authoritative. */
    }
    await deleteDeviceAuthVerifier(normalizeEmail(email));
    return;
  }

  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    /* Clear the durable registry even when localStorage is unavailable. */
  }
  await clearDeviceAuthVerifiers();
}

/** Prefix kept across sign-out so offline password resume still works. */
export const LOCAL_AUTH_STORAGE_PREFIX = STORAGE_PREFIX;
