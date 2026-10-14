/**
 * Former public marketing / legal surfaces. This product has no public website;
 * callers treat these paths as redirects to sign-in.
 */
function pathOnly(hrefOrPath: string): string {
  const path = hrefOrPath.split(/[?#]/, 1)[0] ?? hrefOrPath;
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function exactOrChild(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

const LEGAL_PATHS = ["/privacy", "/terms", "/refund", "/cookies", "/aup", "/dpa"] as const;

const RETIRED_PUBLIC_PATHS = [
  "/download",
  "/pricing",
  "/contact",
  "/demo",
  "/product",
  "/industries",
  "/docs",
  ...LEGAL_PATHS,
] as const;

/** Privacy, terms, refunds, cookies, acceptable use, and the data-processing addendum. */
export function isLegalPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathOnly(pathname);
  return LEGAL_PATHS.some((base) => exactOrChild(path, base));
}

/**
 * True for retired marketing / legal paths (and `/`). Never matches authenticated
 * `/products`.
 */
export function isMarketingPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathOnly(pathname);
  if (path === "/") return true;

  return RETIRED_PUBLIC_PATHS.some((base) => exactOrChild(path, base));
}
