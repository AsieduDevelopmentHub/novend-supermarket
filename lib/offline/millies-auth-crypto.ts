/** PBKDF2-SHA-256 password hashing for Millie's local users (Chemist-compatible). */

const AUTH_ITERATIONS = 120_000;
const HASH_BYTES = 32;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return new Uint8Array(Array.from(binary, (char) => char.charCodeAt(0)));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function deriveBits(
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

export async function hashPassword(
  password: string,
  salt?: Uint8Array,
): Promise<{ salt: string; hash: string; iterations: number }> {
  const saltBytes = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(password, saltBytes, AUTH_ITERATIONS);
  return {
    salt: bytesToBase64(saltBytes),
    hash: bytesToBase64(hash),
    iterations: AUTH_ITERATIONS,
  };
}

export async function verifyPassword(
  password: string,
  saltB64: string,
  hashB64: string,
  iterations: number,
): Promise<boolean> {
  const salt = base64ToBytes(saltB64);
  const expected = base64ToBytes(hashB64);
  const actual = await deriveBits(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}
