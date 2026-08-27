import { NextResponse } from "next/server";

/**
 * Public liveness probe for Capacitor/Electron boot pages.
 * CORS is open so the local boot origin can check the hosted app before
 * navigating — a failed top-level load shows Chrome's "This page couldn't load".
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ok: true as const },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    },
  );
}
