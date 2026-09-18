/** Public marketing surfaces that always render in light mode. */
export function isMarketingPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === "/") return true;
  return (
    pathname.startsWith("/download") ||
    pathname.startsWith("/docs") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/refund") ||
    pathname.startsWith("/cookies") ||
    pathname.startsWith("/aup") ||
    pathname.startsWith("/dpa")
  );
}
