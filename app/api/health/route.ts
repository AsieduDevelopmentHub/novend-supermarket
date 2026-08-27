import { NextResponse } from "next/server";

/**
 * Public liveness probe for Capacitor/Electron boot pages.
 * CORS is open so the local boot origin can check the hosted app before
 * navigating — a failed top-level load shows Chrome's "This page couldn't load".
 */
export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Cache-Control",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export function GET() {
  return NextResponse.json({ ok: true as const }, { headers: cors });
}
