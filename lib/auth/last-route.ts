import { pathAllowedForRole, type AppRole } from "@/config/navigation";
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

function withSearch(pathname: string, search: string): string {
  const normalized = search.startsWith("?") ? search : search ? `?${search}` : "";
  const params = new URLSearchParams(normalized.startsWith("?") ? normalized.slice(1) : normalized);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * Cold-start (`?fromBoot=1`) destination.
 * Stripping the boot flag must not remount the current screen — that is what
 * made Dashboard load twice after login / Capacitor reopen.
 */
export function resolveFromBootTarget(input: {
  pathname: string;
  search: string;
  last: string | null;
  role?: AppRole | null;
  isPlatformAdmin?: boolean;
  platformOnly?: boolean;
}): { href: string; remount: boolean } | null {
  const rawSearch = input.search.startsWith("?") ? input.search.slice(1) : input.search;
  const params = new URLSearchParams(rawSearch);
  if (params.get(FROM_BOOT_PARAM) !== "1") return null;

  params.delete(FROM_BOOT_PARAM);
  const cleanedCurrent = withSearch(input.pathname, params.toString());
  const rawCurrent = withSearch(input.pathname, rawSearch);

  const safe = input.last ? safeInternalPath(input.last) : null;
  const isPlatformPath = Boolean(safe && (safe === "/platform" || safe.startsWith("/platform/")));
  const pathnameOnly = safe ? safe.split("?")[0] || safe : null;
  const roleOk =
    !safe ||
    isPlatformPath ||
    !input.role ||
    !pathnameOnly ||
    pathAllowedForRole(pathnameOnly, input.role);

  const allowed =
    input.platformOnly && safe && !isPlatformPath
      ? "/platform"
      : safe && (!isPlatformPath || input.isPlatformAdmin) && roleOk
        ? safe
        : input.platformOnly
          ? "/platform"
          : null;

  if (allowed && allowed !== cleanedCurrent) {
    return { href: allowed, remount: true };
  }
  if (cleanedCurrent !== rawCurrent) {
    return { href: cleanedCurrent, remount: false };
  }
  return null;
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
