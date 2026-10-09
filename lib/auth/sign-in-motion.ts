const MOTION_KEY = "novend.signInMotionStart";
const BOOT_SPLASH_KEY = "novend.splashBootStart";

/** Stretched sign-in fall. Shared by the login cover and the post-login shell. */
export const SIGN_IN_SPLASH_LAND_MS = 4_200;

/** Short fall used for cold start. Later splashes in the same boot seek this. */
export const SHORT_SPLASH_MS = 1_350;

/** Ignore a timestamp left behind by a crashed leave. */
const MOTION_STALE_MS = 30_000;

/** A second splash inside this window continues the first fall instead of replaying it. */
const BOOT_SPLASH_TTL_MS = 12_000;

export type SplashMotion = {
  linger: boolean;
  settled: boolean;
  elapsedMs: number;
};

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

export function readBootSplashStart(): number | null {
  try {
    const parsed = Number(sessionStorage.getItem(BOOT_SPLASH_KEY));
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeBootSplashStart(startedAt: number): void {
  try {
    sessionStorage.setItem(BOOT_SPLASH_KEY, String(startedAt));
  } catch {
    /* private browsing */
  }
}

/**
 * One clock for every full-screen splash in this document.
 * A sign-in fall already in progress keeps that timeline. A cold-start fall
 * that has already landed stays landed. A new mount must not play the fall
 * from the top again.
 */
export function resolveSplashMotion(input: {
  settled: boolean;
  linger: boolean;
  elapsedMs: number;
  now: number;
  signInStartedAt: number | null;
  bootStartedAt: number | null;
}): { motion: SplashMotion; bootStartedAt: number | null } {
  if (input.settled) {
    return {
      motion: { linger: false, settled: true, elapsedMs: 0 },
      bootStartedAt: input.bootStartedAt,
    };
  }

  const signInAge =
    input.signInStartedAt == null ? null : input.now - input.signInStartedAt;
  if (signInAge != null && signInAge >= 0 && signInAge < MOTION_STALE_MS) {
    const elapsedMs = Math.max(input.linger ? input.elapsedMs : 0, signInAge);
    if (elapsedMs >= SIGN_IN_SPLASH_LAND_MS) {
      return {
        motion: { linger: false, settled: true, elapsedMs: 0 },
        bootStartedAt: input.bootStartedAt,
      };
    }
    return {
      motion: { linger: true, settled: false, elapsedMs },
      bootStartedAt: input.bootStartedAt,
    };
  }

  if (input.linger) {
    const elapsedMs = Math.max(0, input.elapsedMs);
    return {
      motion: {
        linger: elapsedMs < SIGN_IN_SPLASH_LAND_MS,
        settled: elapsedMs >= SIGN_IN_SPLASH_LAND_MS,
        elapsedMs: elapsedMs >= SIGN_IN_SPLASH_LAND_MS ? 0 : elapsedMs,
      },
      bootStartedAt: input.bootStartedAt,
    };
  }

  let bootStartedAt = input.bootStartedAt;
  if (
    bootStartedAt == null ||
    input.now - bootStartedAt >= BOOT_SPLASH_TTL_MS ||
    input.now < bootStartedAt
  ) {
    bootStartedAt = input.now;
  }
  const elapsedMs = input.now - bootStartedAt;
  if (elapsedMs >= SHORT_SPLASH_MS) {
    return {
      motion: { linger: false, settled: true, elapsedMs: 0 },
      bootStartedAt,
    };
  }
  return {
    motion: { linger: false, settled: false, elapsedMs },
    bootStartedAt,
  };
}
