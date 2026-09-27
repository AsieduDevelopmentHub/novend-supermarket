/**
 * Public marketing surfaces (site chrome, light theme, SW shell policy).
 * Segment-bounded so `/product` never matches the authenticated `/products` catalog.
 */
function pathOnly(hrefOrPath: string): string {
  const path = hrefOrPath.split(/[?#]/, 1)[0] ?? hrefOrPath;
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function exactOrChild(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

const LEGAL_PATHS = ["/privacy", "/terms", "/refund", "/cookies", "/aup", "/dpa"] as const;

/** Privacy, terms, refunds, cookies, acceptable use, and the data-processing addendum. */
export function isLegalPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathOnly(pathname);
  return LEGAL_PATHS.some((base) => exactOrChild(path, base));
}

/** True for public marketing paths. Never matches authenticated `/products`. */
export function isMarketingPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathOnly(pathname);
  if (path === "/") return true;

  return (
    exactOrChild(path, "/download") ||
    exactOrChild(path, "/pricing") ||
    exactOrChild(path, "/contact") ||
    exactOrChild(path, "/demo") ||
    exactOrChild(path, "/product") ||
    exactOrChild(path, "/industries") ||
    exactOrChild(path, "/docs") ||
    exactOrChild(path, "/privacy") ||
    exactOrChild(path, "/terms") ||
    exactOrChild(path, "/refund") ||
    exactOrChild(path, "/cookies") ||
    exactOrChild(path, "/aup") ||
    exactOrChild(path, "/dpa") ||
    path === "/unauthorized"
  );
}
