import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { withTimeout } from "@/lib/async/with-timeout";
import { resolvePostAuthPath } from "@/lib/auth/safe-return-path";
import { bindOfflineOrganization } from "@/lib/offline/db";
import { clearOfflineSession, markOfflineSession } from "@/lib/offline/session";
import {
  clearPlatformOfflineSession,
  markPlatformOfflineSession,
} from "@/lib/offline/platform-cache";
import { saveShellProfile } from "@/lib/offline/shell-profile";
import { isCapacitor, isElectron } from "@novend/hardware";

const SKIP_SPLASH_KEY = "novend.auth.skipSplash";
/** Blocks LoginSessionGate / second hard leaves while credentials are resolving. */
const POST_LOGIN_LEAVE_KEY = "novend.auth.postLoginLeave";
/**
 * Online password login just succeeded — shell should treat cloud as authoritative
 * and hide Connect / “Cloud disconnected” while Convex Auth settles.
 */
const ONLINE_SESSION_WARM_KEY = "novend.auth.onlineSessionWarm";
const ONLINE_SESSION_WARM_MS = 30_000;
const RESOLVE_RETRIES = 6;
const RESOLVE_RETRY_MS = 400;
/** Browser soft-navigation fallback only; native hard navigation is single-shot. */
const HARD_NAV_FALLBACK_MS = 800;
/**
 * Per-attempt budget for `users.me` after password sign-in.
 * Auth token / websocket often need several seconds after signOut→signIn.
 */
const ME_QUERY_BUDGET_MS = 8_000;
/** Dexie profile write must not block leaving /login. */
const SHELL_PROFILE_BUDGET_MS = 1_500;

/** In-memory latch for the in-flight hard leave (survives only this JS lifetime). */
let hardNavigationPending = false;

export type PostLoginSession = {
  path: string;
  userId: string;
};

type ExpectedCloudIdentity = {
  expectedEmail?: string | null;
  expectedUserId?: string | null;
  expectedOrganizationId?: string | null;
};

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

/**
 * Credential unlock / auto-resume owns the leave. Set as soon as sign-in
 * succeeds (before `users.me` resolve) so LoginSessionGate cannot hard-leave
 * to `/dashboard` mid-bind and bounce the first login.
 */
export function markPostLoginLeavePending(): void {
  try {
    sessionStorage.setItem(POST_LOGIN_LEAVE_KEY, "1");
  } catch {
    /* private browsing */
  }
}

export function clearPostLoginLeavePending(): void {
  try {
    sessionStorage.removeItem(POST_LOGIN_LEAVE_KEY);
  } catch {
    /* private browsing */
  }
}

/** True while a post-login leave is in flight (resolve, hard nav, or both). */
export function isPostLoginLeavePending(): boolean {
  if (hardNavigationPending) return true;
  try {
    return sessionStorage.getItem(POST_LOGIN_LEAVE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mark a successful online password login before hard-leaving to the shell. */
export function markOnlineSessionWarm(): void {
  try {
    sessionStorage.setItem(ONLINE_SESSION_WARM_KEY, String(Date.now()));
  } catch {
    /* private browsing */
  }
}

export function clearOnlineSessionWarm(): void {
  try {
    sessionStorage.removeItem(ONLINE_SESSION_WARM_KEY);
  } catch {
    /* private browsing */
  }
}

/** True for a short window after online credential login while Convex Auth attaches. */
export function isOnlineSessionWarm(maxAgeMs = ONLINE_SESSION_WARM_MS): boolean {
  try {
    const raw = sessionStorage.getItem(ONLINE_SESSION_WARM_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) {
      sessionStorage.removeItem(ONLINE_SESSION_WARM_KEY);
      return false;
    }
    if (Date.now() - at > maxAgeMs) {
      sessionStorage.removeItem(ONLINE_SESSION_WARM_KEY);
      return false;
    }
    return true;
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
  if (me.isPlatformAdmin && !me.organizationId) {
    clearOfflineSession();
    markPlatformOfflineSession({
      userId: String(me.userId),
      name: me.name ?? "Admin",
      email: me.email ?? null,
      hasTenantRole: false,
      savedAt: Date.now(),
    });
    return;
  }
  if (!me.organizationId || !me.role || !me.branchId) return;
  // Tenant login must drop any leftover Super Admin offline marker — otherwise
  // LoginSessionGate / hydrate treat the till as platform and bounce to /platform.
  clearPlatformOfflineSession();
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
    try {
      await withTimeout(
        saveShellProfile({
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
        }),
        SHELL_PROFILE_BUDGET_MS,
        "shell profile timeout",
      );
    } catch {
      /* localStorage session hint already set; Dexie profile can catch up later */
    }
  }
}

/**
 * Resolve the post-login route + user id from the live session.
 * Retries briefly while the Convex client picks up the auth token after signIn.
 *
 * Always rebinds Dexie + the offline-session hint from live `me` so a previous
 * offline cashier cannot stay active after a different email signs in.
 * Returns `userId` so the login form can store the offline password digest
 * without a second hung `users.me` round-trip.
 */
export async function resolvePostLoginSession(
  convex: ConvexReactClient,
  next?: string | null,
  options?: ExpectedCloudIdentity,
): Promise<PostLoginSession> {
  const expectedEmail = options?.expectedEmail?.trim().toLowerCase() || null;
  const expectedUserId = options?.expectedUserId ? String(options.expectedUserId) : null;
  const expectedOrganizationId = options?.expectedOrganizationId
    ? String(options.expectedOrganizationId)
    : null;
  let lastError: unknown;

  for (let attempt = 0; attempt < RESOLVE_RETRIES; attempt++) {
    try {
      const me = await withTimeout(
        convex.query(api.users.me, {}),
        ME_QUERY_BUDGET_MS,
        "Could not load your profile after sign-in. Check your connection and try again.",
      );
      if (!me?.userId) {
        throw new Error(
          "Could not load your profile after sign-in. Check your connection and try again.",
        );
      }
      if (expectedUserId && String(me.userId) !== expectedUserId) {
        throw new Error(
          "Account mismatch: the cloud session belongs to a different user. Verify this account again.",
        );
      }
      if (
        expectedOrganizationId &&
        String(me.organizationId ?? "") !== expectedOrganizationId
      ) {
        throw new Error(
          "Account mismatch: the cloud session belongs to a different business. Verify this account again.",
        );
      }
      if (expectedEmail) {
        const liveEmail = me.email ? String(me.email).trim().toLowerCase() : "";
        if (!liveEmail) {
          throw new Error(
            "Account mismatch: the signed-in profile has no email. Sign out and try again.",
          );
        }
        if (liveEmail !== expectedEmail) {
          throw new Error(
            "Account mismatch: the signed-in profile is not the email you entered. Sign out and try again.",
          );
        }
      }
      await bindReplicaFromMe(me);
      return {
        path: resolvePostAuthPath(me, next),
        userId: String(me.userId),
      };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : "";
      // Fail closed immediately on identity mismatch; keep retrying profile/auth settle.
      if (message.toLowerCase().includes("mismatch")) {
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

export async function resolvePostLoginPath(
  convex: ConvexReactClient,
  next?: string | null,
  options?: ExpectedCloudIdentity,
): Promise<string> {
  const session = await resolvePostLoginSession(convex, next, options);
  return session.path;
}

/**
 * Tag hard leaves so the service worker serves the cached app shell immediately.
 * Uses `fromLogin=1` (not `fromBoot=1`) so RestoreLastRoute does not remount the
 * last in-app path after credential unlock — that stacked a second shell paint.
 * Cold boot / offline-boot trampolines still use `fromBoot` elsewhere.
 */
export function withPostLoginShellMarker(path: string): string {
  if (!path.startsWith("/")) return path;
  if (path.includes("fromLogin=") || path.includes("fromBoot=")) return path;
  return `${path}${path.includes("?") ? "&" : "?"}fromLogin=1`;
}

/** @deprecated Prefer withPostLoginShellMarker for credential leave; keep for cold-boot helpers. */
export function withShellBootMarker(path: string): string {
  if (!path.startsWith("/")) return path;
  if (path.includes("fromBoot=")) return path;
  return `${path}${path.includes("?") ? "&" : "?"}fromBoot=1`;
}

/**
 * Chrome / Electron / Cap WebView treat a typed login form as unsaved edits.
 * A following `location.replace` then shows “Leave site?”. Sync each field's
 * default to its current value and reset the form while inputs are still in
 * the DOM so Chromium clears that dirty bit.
 *
 * Must run in the **same synchronous turn** as `location.replace` — any
 * `await` in between lets React unmount the form and the clean is wasted.
 *
 * Do **not** detach React-owned form nodes from the document here. That races
 * the reconciler and surfaces as `Failed to execute 'removeChild'` with the
 * app error “Try again / Go to dashboard” sheet after Welcome.
 */
export function prepareHardNavigation(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  window.onbeforeunload = null;

  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();

  const fields = document.querySelectorAll("input, textarea, select");
  for (const element of Array.from(fields)) {
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

  // After defaults match values, reset keeps the same visible data and clears
  // Chromium's "user edited this form" bit used for the leave-site prompt.
  for (const form of Array.from(document.forms)) {
    try {
      form.reset();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Leave auth pages for the app shell.
 *
 * Capacitor / Electron / offline / post-password: SoftNav is not mounted on
 * `/login`, so history+popstate alone leaves the login layout painted on top
 * of a dashboard URL (skeleton forever after “Welcome”). Prefer a single
 * `location.replace`.
 *
 * Web online without `hard`: soft `router.replace`, with a short hard fallback.
 */
export function navigateAfterLogin(
  path: string,
  router: AppRouter,
  options?: { hard?: boolean },
): void {
  markPostLoginLeavePending();
  markSkipStartupSplash();

  const forceHard =
    options?.hard === true ||
    (typeof window !== "undefined" && (isCapacitor() || isElectron() || !navigator.onLine));

  const target = forceHard ? withPostLoginShellMarker(path) : path;

  if (typeof window !== "undefined" && forceHard) {
    // The first hard leave owns the native handoff. Re-running replace while
    // the service worker is resolving the document causes visible reloads.
    if (hardNavigationPending) return;
    hardNavigationPending = true;
    prepareHardNavigation();
    window.location.replace(target);
    return;
  }

  router.replace(target);

  if (typeof window === "undefined") return;

  window.setTimeout(() => {
    const here = window.location.pathname;
    if (here === "/login" || here === "/signup" || here === "/onboarding") {
      if (hardNavigationPending) return;
      hardNavigationPending = true;
      prepareHardNavigation();
      window.location.replace(withPostLoginShellMarker(path));
    }
  }, HARD_NAV_FALLBACK_MS);
}
