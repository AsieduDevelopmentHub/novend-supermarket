import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { postLoginPath } from "@/lib/auth/post-login-path";

const SKIP_SPLASH_KEY = "novend.auth.skipSplash";
const RESOLVE_RETRIES = 6;
const RESOLVE_RETRY_MS = 120;

type AppRouter = {
  replace: (href: string) => void;
  refresh: () => void | Promise<void>;
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
 */
export async function resolvePostLoginPath(convex: ConvexReactClient): Promise<string> {
  for (let attempt = 0; attempt < RESOLVE_RETRIES; attempt++) {
    try {
      const me = await convex.query(api.users.me, {});
      return postLoginPath(me);
    } catch {
      if (attempt === RESOLVE_RETRIES - 1) break;
      await wait(RESOLVE_RETRY_MS * (attempt + 1));
    }
  }
  return "/dashboard";
}

/**
 * Navigate after sign-in without unloading the document.
 *
 * Uses Next.js soft navigation so we do not trigger Convex Auth's beforeunload
 * guard (active while refresh tokens sync). Hard `window.location` navigations
 * show Android WebView's native "Confirm navigation" dialog during that window.
 */
export function navigateAfterLogin(path: string, router: AppRouter): void {
  markSkipStartupSplash();
  router.replace(path);
  void router.refresh();
}
