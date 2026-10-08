const MOTION_KEY = "novend.signInMotionStart";

/** Stretched sign-in fall. Shared by the login cover and the post-login shell. */
export const SIGN_IN_SPLASH_LAND_MS = 4_200;

/** Ignore a timestamp left behind by a crashed leave. */
const MOTION_STALE_MS = 30_000;

export function markSignInMotionStart(now = Date.now()): number {
  try {
    const existing = Number(sessionStorage.getItem(MOTION_KEY));
    if (Number.isFinite(existing) && now - existing >= 0 && now - existing < MOTION_STALE_MS) {
      return existing;
    }
    sessionStorage.setItem(MOTION_KEY, String(now));
  } catch {
    /* private browsing */
  }
  return now;
}

export function readSignInMotionStart(): number | null {
  try {
    const parsed = Number(sessionStorage.getItem(MOTION_KEY));
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSignInMotionStart(): void {
  try {
    sessionStorage.removeItem(MOTION_KEY);
  } catch {
    /* private browsing */
  }
}

/**
 * Negative delays seek the CSS fall/float so a hard navigation (web, PWA,
 * Capacitor, Electron) continues the same motion instead of restarting it.
 */
export function signInCoverDelays(elapsedMs: number): { fallDelayMs: number; holdDelayMs: number } {
  const elapsed = Math.max(0, elapsedMs);
  return {
    fallDelayMs: elapsed === 0 ? 0 : -elapsed,
    holdDelayMs: SIGN_IN_SPLASH_LAND_MS - elapsed,
  };
}
