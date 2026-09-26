"use client";

import { useConnectivity } from "@/hooks/use-connectivity";
import { isCapacitor, isElectron } from "@novend/hardware";

/**
 * True when the authenticated shell should render Dexie-backed client views
 * instead of waiting on Next RSC / Convex soft navigation.
 *
 * Capacitor and Electron always use client views — native shells + RSC soft
 * nav are unreliable offline and under false-online (navigator.onLine true
 * while the radio cannot reach the host). Web stays on the first RSC paint
 * while online so the dashboard is not remounted after a timer.
 */
export function shouldForceClientShell(input: {
  capacitor: boolean;
  electron?: boolean;
  online: boolean;
}): boolean {
  return input.capacitor || Boolean(input.electron) || !input.online;
}

export function useForceClientShell(): boolean {
  const online = useConnectivity();
  const capacitor = typeof window !== "undefined" && isCapacitor();
  const electron = typeof window !== "undefined" && isElectron();
  return shouldForceClientShell({ capacitor, electron, online });
}
