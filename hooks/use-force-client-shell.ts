"use client";

import { useConvexAuth } from "convex/react";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useOfflineSessionHint } from "@/hooks/use-offline-session-hint";
import { isAwaitingCloudReconnect } from "@/lib/auth/awaiting-cloud-reconnect";
import { isCapacitor, isElectron } from "@novend/hardware";

/**
 * True when the authenticated shell should render Dexie-backed client views
 * instead of waiting on Next RSC / Convex soft navigation.
 *
 * Capacitor and Electron always use client views — native shells + RSC soft
 * nav are unreliable offline and under false-online (navigator.onLine true
 * while the radio cannot reach the host). Web stays on the first RSC paint
 * while online so the dashboard is not remounted after a timer — except when
 * the till is on an offline shell without a Convex JWT: RSC would 302 to
 * /login and drop the cashier mid-shift.
 */
export function shouldForceClientShell(input: {
  capacitor: boolean;
  electron?: boolean;
  online: boolean;
  awaitingCloudReconnect?: boolean;
}): boolean {
  return (
    input.capacitor ||
    Boolean(input.electron) ||
    !input.online ||
    Boolean(input.awaitingCloudReconnect)
  );
}

export function useForceClientShell(): boolean {
  const online = useConnectivity();
  const { isAuthenticated } = useConvexAuth();
  const sessionHint = useOfflineSessionHint();
  const capacitor = typeof window !== "undefined" && isCapacitor();
  const electron = typeof window !== "undefined" && isElectron();
  const awaitingCloudReconnect = isAwaitingCloudReconnect({
    isAuthenticated,
    sessionHint,
  });
  return shouldForceClientShell({
    capacitor,
    electron,
    online,
    awaitingCloudReconnect,
  });
}
