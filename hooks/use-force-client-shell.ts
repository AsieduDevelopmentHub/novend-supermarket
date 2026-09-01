"use client";

import { useConnectivity } from "@/hooks/use-connectivity";
import { isCapacitor } from "@novend/hardware";

/**
 * True when the authenticated shell should render Dexie-backed client views
 * instead of waiting on Next RSC / Convex soft navigation.
 *
 * Capacitor always uses client views — WebView + RSC soft nav is unreliable
 * offline and under flaky cellular. Web and Electron stay on the first RSC
 * paint while online so the dashboard is not remounted after a timer.
 */
export function shouldForceClientShell(input: { capacitor: boolean; online: boolean }): boolean {
  return input.capacitor || !input.online;
}

export function useForceClientShell(): boolean {
  const online = useConnectivity();
  const capacitor = typeof window !== "undefined" && isCapacitor();
  return shouldForceClientShell({ capacitor, online });
}
