import { NextResponse } from "next/server";

/**
 * Same-origin proxy for Cap / browser update checks.
 * Avoids relying on process.env inside @novend/hardware and skips CORS edge cases
 * when the WebView fetches Convex HTTP directly.
 *
 * Short revalidate window — release metadata changes infrequently; clients still
 * poll on a restrained interval and can force a fresh check from Settings.
 */
export const revalidate = 300;

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

function resolveUpstreamLatestUrl(search: string): string | null {
  const fromPublic = process.env.NEXT_PUBLIC_MOBILE_UPDATE_JSON?.trim();
  if (fromPublic) {
    const url = new URL(fromPublic);
    if (search) {
      const extra = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
      extra.forEach((value, key) => url.searchParams.set(key, value));
    }
    return url.toString();
  }
  const site =
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.replace(/\/$/, "") ||
    (process.env.NEXT_PUBLIC_CONVEX_URL
      ? process.env.NEXT_PUBLIC_CONVEX_URL.replace(/\.cloud\/?$/, ".site").replace(/\/$/, "")
      : null);
  if (!site) return null;
  const qs = search && search !== "?" ? search : "";
  return `${site}/mobile-updates/latest${qs.startsWith("?") ? qs : qs ? `?${qs}` : ""}`;
}

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  const upstream = resolveUpstreamLatestUrl(search);
  if (!upstream) {
    return NextResponse.json(
      { ok: false, error: "Update endpoint is not configured for this build." },
      { status: 503, headers: { "cache-control": CACHE_CONTROL } },
    );
  }
  try {
    const response = await fetch(upstream, {
      next: { revalidate: 300 },
      headers: { accept: "application/json" },
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
        "cache-control": CACHE_CONTROL,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not reach the update server." },
      { status: 502, headers: { "cache-control": CACHE_CONTROL } },
    );
  }
}
