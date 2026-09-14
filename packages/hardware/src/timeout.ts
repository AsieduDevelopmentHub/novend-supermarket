/**
 * Bounded waits for Capacitor / native plugin calls so Settings and scanners
 * never hang the WebView forever.
 */

/** Short bridge calls (prefs, one-shot status). */
export const NATIVE_CALL_TIMEOUT_MS = 2500;
/**
 * Settings Security probes must fail soft quickly — a hung Cap call blocks the
 * entire WebView bridge (camera, notifications, UI feel frozen).
 */
export const NATIVE_SETTINGS_PROBE_MS = 3500;
/**
 * First-load availability checks (dynamic import + Cap bridge).
 * Prefer NATIVE_SETTINGS_PROBE_MS for Settings Security mounts.
 */
export const NATIVE_AVAILABILITY_TIMEOUT_MS = 8_000;
export const NATIVE_SCAN_TIMEOUT_MS = 45_000;
export const NATIVE_BLE_TIMEOUT_MS = 12_000;
/** Classic RFCOMM connect can take longer than BLE GATT. */
export const NATIVE_SPP_TIMEOUT_MS = 20_000;
/** User may take time in the system camera UI — do not race-abandon capture. */
export const NATIVE_CAMERA_TIMEOUT_MS = 180_000;

export class NativeTimeoutError extends Error {
  constructor(message = "timeout") {
    super(message);
    this.name = "NativeTimeoutError";
  }
}

export function isNativeTimeoutError(error: unknown): boolean {
  return (
    error instanceof NativeTimeoutError || (error instanceof Error && error.message === "timeout")
  );
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
