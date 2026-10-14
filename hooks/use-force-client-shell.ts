"use client";

import { FULLY_OFFLINE } from "@/constants/runtime";
import { useConnectivity } from "@/hooks/use-connectivity";
import { isCapacitor, isElectron } from "@novend/hardware";

/**
 * True when the authenticated shell should render Dexie-backed client views
 * instead of waiting on Next RSC / Convex soft navigation.
 */
export function shouldForceClientShell(input: {
  capacitor: boolean;
  electron?: boolean;
  online: boolean;
  awaitingCloudReconnect?: boolean;
}): boolean {
  if (FULLY_OFFLINE) return true;
  return (
    input.capacitor ||
    Boolean(input.electron) ||
    !input.online ||
    Boolean(input.awaitingCloudReconnect)
  );
}

export function useForceClientShell(): boolean {
  const online = useConnectivity();
  const capacitor = typeof window !== "undefined" && isCapacitor();
  const electron = typeof window !== "undefined" && isElectron();
  return shouldForceClientShell({
    capacitor,
    electron,
    online,
    awaitingCloudReconnect: FULLY_OFFLINE,
  });
}
