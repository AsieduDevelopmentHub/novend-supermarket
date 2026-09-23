export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_MIN_INTERVAL_MS = 60 * 1000;
export const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_MAX_REQUESTS_PER_WINDOW = 5;

export function hexFromBuffer(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashPasswordResetToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return hexFromBuffer(digest);
}

export function createPasswordResetToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return hexFromBuffer(bytes.buffer);
}

export function isPasswordResetExpired(expiresAt: number, now = Date.now()): boolean {
  return now >= expiresAt;
}

export function isPasswordResetUsed(usedAt: number | undefined): boolean {
  return typeof usedAt === "number";
}

export function passwordResetRejectReason(row: {
  expiresAt: number;
  usedAt?: number;
}): "expired" | "used" | null {
  if (isPasswordResetUsed(row.usedAt)) return "used";
  if (isPasswordResetExpired(row.expiresAt)) return "expired";
  return null;
}

export function tooManyPasswordResetRequests(
  createdAtList: number[],
  now = Date.now(),
): boolean {
  const windowStart = now - PASSWORD_RESET_WINDOW_MS;
  return (
    createdAtList.filter((createdAt) => createdAt >= windowStart).length >=
    PASSWORD_RESET_MAX_REQUESTS_PER_WINDOW
  );
}
