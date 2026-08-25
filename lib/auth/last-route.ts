import { safeInternalPath } from "@/lib/auth/safe-return-path";

export const LAST_ROUTE_KEY = "novend.lastRoute";
export const FROM_BOOT_PARAM = "fromBoot";

function stripBootParam(pathWithSearch: string): string {
  try {
    const url = new URL(pathWithSearch, "http://novend.local");
    url.searchParams.delete(FROM_BOOT_PARAM);
    const path = url.pathname.replace(/\/$/, "") || "/";
    const search = url.searchParams.toString();
    return search ? `${path}?${search}` : path;
  } catch {
    return pathWithSearch;
  }
}

/** Persist the last successful in-app path for Capacitor/Electron cold start. */
export function persistLastRoute(pathWithSearch: string): void {
  const cleaned = stripBootParam(pathWithSearch);
  const safe = safeInternalPath(cleaned);
  if (!safe || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_ROUTE_KEY, safe);
  } catch {
    /* private browsing */
  }
}

export function readLastRoute(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return safeInternalPath(window.localStorage.getItem(LAST_ROUTE_KEY));
  } catch {
    return null;
  }
}

/** Drop device last-route so the next user cannot inherit Super Admin deep links. */
export function clearLastRoute(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_ROUTE_KEY);
  } catch {
    /* private browsing */
  }
}
