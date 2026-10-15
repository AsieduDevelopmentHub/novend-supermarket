import { LICENSE_PREFIX, resolveLicenseSecret } from "./constants";
import type { LicensePayload } from "./types";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, utf8(message) as BufferSource);
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Trim whitespace only — body is case-sensitive base64url. */
export function normalizeLicenseKeyInput(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

export function formatLicenseKeyForDisplay(key: string): string {
  return normalizeLicenseKeyInput(key);
}

function encodePayload(payload: LicensePayload): string {
  return toBase64Url(utf8(JSON.stringify(payload)));
}

function decodePayload(encoded: string): LicensePayload {
  const json = new TextDecoder().decode(fromBase64Url(encoded));
  const parsed = JSON.parse(json) as LicensePayload;
  if (parsed.v !== 1 || typeof parsed.c !== "string" || typeof parsed.i !== "number") {
    throw new Error("Invalid license payload");
  }
  return parsed;
}

/** Build signed key: NMIL.<payload>.<sig32hex> */
export async function issueLicenseKey(
  payload: Omit<LicensePayload, "v">,
  secret = resolveLicenseSecret(),
): Promise<string> {
  const full: LicensePayload = {
    v: 1,
    c: payload.c.trim(),
    i: payload.i,
    e: payload.e ?? null,
    m: payload.m ?? null,
  };
  if (!full.c) throw new Error("Customer label is required");
  const body = encodePayload(full);
  const sig = (await hmacSha256Hex(secret, body)).slice(0, 32);
  return `${LICENSE_PREFIX}.${body}.${sig}`;
}

export async function verifyLicenseKey(
  rawKey: string,
  secret = resolveLicenseSecret(),
): Promise<LicensePayload> {
  const key = normalizeLicenseKeyInput(rawKey);
  const parts = key.split(".");
  if (parts.length !== 3 || parts[0]!.toUpperCase() !== LICENSE_PREFIX) {
    throw new Error("Enter a valid Millie's license key (NMIL.…)");
  }
  const body = parts[1]!;
  const sig = parts[2]!;
  if (!body || !sig || sig.length < 16) {
    throw new Error("License key is incomplete");
  }
  const expected = (await hmacSha256Hex(secret, body)).slice(0, 32);
  if (expected.toLowerCase() !== sig.toLowerCase()) {
    throw new Error("License key signature is invalid");
  }
  const payload = decodePayload(body);
  if (payload.e != null && payload.e > 0 && Date.now() > payload.e) {
    throw new Error("This license key has expired");
  }
  return payload;
}
