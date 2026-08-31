"use client";

import { useSyncExternalStore } from "react";
import {
  OFFLINE_SESSION_EVENT,
  getOfflineSessionSnapshot,
  type OfflineSessionHint,
} from "@/lib/offline/session";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(OFFLINE_SESSION_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(OFFLINE_SESSION_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

/**
 * Login writes the session hint before navigating. Read it with the
 * server-snapshot-null pattern so SSR hydrates as "unknown role" (loading)
 * instead of cashier chrome, then the client paints admin/manager immediately.
 */
export function useOfflineSessionHint(): OfflineSessionHint | null {
  return useSyncExternalStore(subscribe, getOfflineSessionSnapshot, () => null);
}
