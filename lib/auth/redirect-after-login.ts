import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { resolvePostAuthPath } from "@/lib/auth/safe-return-path";

const SKIP_SPLASH_KEY = "novend.auth.skipSplash";
const RESOLVE_RETRIES = 8;
const RESOLVE_RETRY_MS = 100;
/** Soft nav stalled on auth pages — last-resort assign after cookies settle. */
const HARD_NAV_FALLBACK_MS = 2500;

type AppRouter = {
  replace: (href: string) => void;
  refresh?: () => void | Promise<void>;
};

export function markSkipStartupSplash(): void {
  try {
    sessionStorage.setItem(SKIP_SPLASH_KEY, "1");
  } catch {
    /* private browsing */
  }
}

/** One-shot flag set before post-login navigation. */
export function consumeSkipStartupSplash(): boolean {
  try {
    const skip = sessionStorage.getItem(SKIP_SPLASH_KEY) === "1";
    if (skip) sessionStorage.removeItem(SKIP_SPLASH_KEY);
    return skip;
  } catch {
    return false;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Resolve the post-login route from the live session.
 * Retries briefly while the Convex client picks up the auth token after signIn.
 * Honors a safe `next` return path when provided.
 */
export async function resolvePostLoginPath(
  convex: ConvexReactClient,
  next?: string | null,
): Promise<string> {
  for (let attempt = 0; attempt < RESOLVE_RETRIES; attempt++) {
    try {
      const me = await convex.query(api.users.me, {});
      return resolvePostAuthPath(me, next);
    } catch {
      if (attempt === RESOLVE_RETRIES - 1) break;
    }
    await wait(RESOLVE_RETRY_MS * (attempt + 1));
  }
  return resolvePostAuthPath(null, next);
}

/**
 * Navigate after sign-in without unloading the document.
 *
 * Soft `replace` only — do not call `router.refresh()` immediately. Refreshing
 * while still notionally on `/login` races Convex Auth cookie sync and the
 * middleware “authenticated on /login → redirect” gate, which can leave a blank
 * screen with the URL stuck on `/login`.
 *
 * Hard `window.location` is a delayed fallback only if soft nav never leaves
 * the auth pages (after refresh tokens have had time to sync).
 */
export function navigateAfterLogin(path: string, router: AppRouter): void {
  markSkipStartupSplash();
  router.replace(path);

  if (typeof window === "undefined") return;

  window.setTimeout(() => {
    const here = window.location.pathname;
    if (here === "/login" || here === "/signup") {
      window.location.assign(path);
    }
  }, HARD_NAV_FALLBACK_MS);
}
