const KEEP_EXACT = new Set([
  "novend.device.fingerprint",
  "novend.device.fingerprint.native",
  "novend.device.name",
  "novend.terminal.printer",
  "novend.terminal.scanner",
  "novend.posPreferences",
  /** Shared-till idle timeout — device preference, not user session data. */
  "novend.idleLock.timeoutMinutes",
  "princellen.terminal.printer",
  "novend-theme",
  "novend-font-size",
]);

function shouldKeepKey(key: string): boolean {
  if (KEEP_EXACT.has(key)) return true;
  if (key.startsWith("novend.device.")) return true;
  return false;
}

function clearMatchingKeys(storage: Storage): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key) keys.push(key);
  }
  for (const key of keys) {
    if (key.startsWith("novend.") || key.startsWith("princellen.")) {
      if (!shouldKeepKey(key)) storage.removeItem(key);
    }
  }
}

/**
 * Drop the signed-out user's session keys. Keep device identity, hardware
 * pairing, appearance, and org print-mode so the next cashier can sign in
 * on the same terminal.
 */
export function clearUserDeviceState(): void {
  if (typeof window === "undefined") return;
  try {
    clearMatchingKeys(window.localStorage);
  } catch {
    /* private mode */
  }
  try {
    clearMatchingKeys(window.sessionStorage);
  } catch {
    /* private mode */
  }
}
