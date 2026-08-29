export const EMAIL_OTP_LENGTH = 6;
export const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;
export const EMAIL_OTP_RESEND_INTERVAL_MS = 60 * 1000;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;
export const EMAIL_OTP_MAX_SENDS_PER_HOUR = 8;
export const EMAIL_OTP_HOUR_MS = 60 * 60 * 1000;

const GENERIC_OTP_ERROR = "That code is incorrect or has expired.";

export function hexFromBuffer(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createEmailOtpCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const value = new DataView(bytes.buffer).getUint32(0, false) % 1_000_000;
  return value.toString().padStart(EMAIL_OTP_LENGTH, "0");
}

export async function hashEmailOtp(userId: string, email: string, code: string): Promise<string> {
  const material = `${userId}:${email.trim().toLowerCase()}:${code}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return hexFromBuffer(digest);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isWellFormedEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf("@");
  if (at < 1) return "your email";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const dots = Math.max(2, Math.min(local.length - 1, 6));
  return `${local.slice(0, 1)}${"•".repeat(dots)}@${domain}`;
}

export function isEmailOtpExpired(expiresAt: number, now = Date.now()): boolean {
  return now >= expiresAt;
}

export function emailOtpRejectReason(row: {
  expiresAt: number;
  usedAt?: number;
  attemptCount: number;
  now?: number;
}): "expired" | "used" | "locked" | null {
  if (typeof row.usedAt === "number") return "used";
  if (isEmailOtpExpired(row.expiresAt, row.now ?? Date.now())) return "expired";
  if (row.attemptCount >= EMAIL_OTP_MAX_ATTEMPTS) return "locked";
  return null;
}

export function emailOtpGenericError(): string {
  return GENERIC_OTP_ERROR;
}

export function canResendEmailOtp(lastCreatedAt: number | undefined, now = Date.now()): boolean {
  if (lastCreatedAt === undefined) return true;
  return now - lastCreatedAt >= EMAIL_OTP_RESEND_INTERVAL_MS;
}

export function resendWaitMs(lastCreatedAt: number, now = Date.now()): number {
  return Math.max(0, EMAIL_OTP_RESEND_INTERVAL_MS - (now - lastCreatedAt));
}

export function tooManySends(createdAtList: number[], now = Date.now()): boolean {
  const windowStart = now - EMAIL_OTP_HOUR_MS;
  return createdAtList.filter((createdAt) => createdAt >= windowStart).length >= EMAIL_OTP_MAX_SENDS_PER_HOUR;
}

export function isEmailVerifiedRecord(row: { email: string; verifiedAt: number } | null, currentEmail: string): boolean {
  if (!row) return false;
  return row.email === normalizeEmail(currentEmail) && row.verifiedAt > 0;
}

/** Client flags are never authority. Only the server record counts. */
export function readAuthoritativeEmailVerified(server: { emailVerified: boolean }): boolean {
  return server.emailVerified === true;
}

export function shouldShowEmailVerificationReminder(args: {
  online: boolean;
  emailVerified: boolean | undefined;
  dismissed: boolean;
}): boolean {
  if (!args.online) return false;
  if (args.emailVerified !== false) return false;
  if (args.dismissed) return false;
  return true;
}
