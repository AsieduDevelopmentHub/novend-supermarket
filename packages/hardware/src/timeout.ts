/**
 * Bounded waits for Capacitor / native plugin calls so Settings and scanners
 * never hang the WebView forever.
 */

export const NATIVE_CALL_TIMEOUT_MS = 2500;
export const NATIVE_SCAN_TIMEOUT_MS = 45_000;
export const NATIVE_BLE_TIMEOUT_MS = 12_000;
export const NATIVE_CAMERA_TIMEOUT_MS = 60_000;

export class NativeTimeoutError extends Error {
  constructor(message = "timeout") {
    super(message);
    this.name = "NativeTimeoutError";
  }
}

export function isNativeTimeoutError(error: unknown): boolean {
  return error instanceof NativeTimeoutError || (error instanceof Error && error.message === "timeout");
}

/** Rejects if `promise` does not settle within `ms`. */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new NativeTimeoutError()), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Runs `operation` with a timeout. On timeout or throw, returns `fallback`
 * instead of rejecting — for mount-time availability checks.
 */
export async function withTimeoutFallback<T>(
  operation: () => Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  try {
    return await withTimeout(operation(), ms);
  } catch {
    return fallback;
  }
}
