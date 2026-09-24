import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { resolvePostAuthPath } from "@/lib/auth/safe-return-path";
import { bindOfflineOrganization } from "@/lib/offline/db";
import { markOfflineSession } from "@/lib/offline/session";
import { saveShellProfile } from "@/lib/offline/shell-profile";
import { isCapacitor } from "@novend/hardware";

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
 * Bind the org-scoped Dexie replica before navigating into the app shell so
 * dashboard hydration does not open `novend-offline-anon` first.
 */
async function bindReplicaFromMe(
  me: {
    userId?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    branchId?: string | null;
    branch?: string | null;
    organizationId?: string | null;
    isPlatformAdmin?: boolean | null;
  } | null,
): Promise<void> {
  if (!me?.userId) return;
  if (me.isPlatformAdmin && !me.organizationId) return;
  if (!me.organizationId || !me.role || !me.branchId) return;
  bindOfflineOrganization(String(me.organizationId), String(me.userId));
  markOfflineSession({
    userId: String(me.userId),
    name: me.name ?? "User",
    email: me.email ?? undefined,
    role: me.role,
    branchId: String(me.branchId),
    branchName: me.branch ?? "Branch",
    organizationId: String(me.organizationId),
    savedAt: Date.now(),
  });
  if (me.role === "administrator" || me.role === "manager" || me.role === "cashier") {
    await saveShellProfile({
      userId: String(me.userId),
      name: me.name ?? "User",
      role: me.role,
      branchId: String(me.branchId),
      branchName: me.branch ?? "Branch",
      imageUrl: null,
      email: me.email ?? null,
      phone: null,
      organizationName: null,
      organizationId: String(me.organizationId),
    });
  }
}

/**
 * Resolve the post-login route from the live session.
 * Retries briefly while the Convex client picks up the auth token after signIn.
 * Honors a safe `next` return path when provided.
 *
 * Always rebinds Dexie + the offline-session hint from live `me` so a previous
 * offline cashier cannot stay active after a different email signs in.
 */
export async function resolvePostLoginPath(
  convex: ConvexReactClient,
  next?: string | null,
  options?: { expectedEmail?: string | null },
): Promise<string> {
  const expectedEmail = options?.expectedEmail?.trim().toLowerCase() || null;
  let lastError: unknown;

  for (let attempt = 0; attempt < RESOLVE_RETRIES; attempt++) {
    try {
      const me = await convex.query(api.users.me, {});
      if (!me?.userId) {
        throw new Error(
          "Could not load your profile after sign-in. Check your connection and try again.",
        );
      }
      if (expectedEmail && me.email) {
        const liveEmail = String(me.email).trim().toLowerCase();
        if (liveEmail && liveEmail !== expectedEmail) {
          throw new Error(
            "Account mismatch: the signed-in profile is not the email you entered. Sign out and try again.",
          );
        }
      }
      await bindReplicaFromMe(me);
      return resolvePostAuthPath(me, next);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : "";
      if (
        message.toLowerCase().includes("account mismatch") ||
        message.toLowerCase().includes("could not load your profile")
      ) {
        throw error;
      }
      if (attempt === RESOLVE_RETRIES - 1) break;
    }
    await wait(RESOLVE_RETRY_MS * (attempt + 1));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not load your profile after sign-in. Check your connection and try again.");
}

/**
 * Chrome / Android WebView treat a typed login form as unsaved edits. A
 * following `location.replace` then shows “Leave this page?”. Syncing each
 * field's default to its current value marks the document clean.
 */
export function prepareHardNavigation(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  window.onbeforeunload = null;
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
  for (const form of Array.from(document.forms)) {
    for (const element of Array.from(form.elements)) {
      if (element instanceof HTMLInputElement) {
        if (element.type === "checkbox" || element.type === "radio") {
          element.defaultChecked = element.checked;
        } else {
          element.defaultValue = element.value;
        }
      } else if (element instanceof HTMLTextAreaElement) {
        element.defaultValue = element.value;
      } else if (element instanceof HTMLSelectElement) {
        for (const option of Array.from(element.options)) {
          option.defaultSelected = option.selected;
        }
      }
    }
  }
}

/**
 * Leave auth pages for the app shell.
 *
 * Capacitor / offline: SoftNav is not mounted on `/login`, so history+popstate
 * alone leaves the login layout painted on top of a dashboard URL (stacked
 * splash / broken dashboard). Use a single `location.replace` instead.
 *
 * Web online: soft `router.replace`, with a hard fallback if we never leave auth.
 */
export function navigateAfterLogin(path: string, router: AppRouter): void {
  markSkipStartupSplash();

  if (typeof window !== "undefined" && (isCapacitor() || !navigator.onLine)) {
    prepareHardNavigation();
    window.location.replace(path);
    return;
  }

  router.replace(path);

  if (typeof window === "undefined") return;

  window.setTimeout(() => {
    const here = window.location.pathname;
    if (here === "/login" || here === "/signup" || here === "/onboarding") {
      prepareHardNavigation();
      window.location.assign(path);
    }
  }, HARD_NAV_FALLBACK_MS);
}
