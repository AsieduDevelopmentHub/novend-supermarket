"use client";

import { useEffect, useState } from "react";
import { useConnectivity } from "@/hooks/use-connectivity";
import { isCapacitor } from "@novend/hardware";

/**
 * Prefer Dexie when the device is offline, or when connectivity looks online
 * but the remote query never settles (common on Capacitor false-online).
 *
 * Cap uses a shorter budget — WebView often reports online while Convex is dead.
 */
export function usePreferLocalData(remoteSettled: boolean, budgetMs?: number): boolean {
  const online = useConnectivity();
  const [budgetElapsed, setBudgetElapsed] = useState(false);
  const native = typeof window !== "undefined" && isCapacitor();
  const ms = budgetMs ?? (native ? 1200 : 3200);

  useEffect(() => {
    if (!online || remoteSettled) {
      queueMicrotask(() => setBudgetElapsed(false));
      return;
    }
    const timer = window.setTimeout(() => setBudgetElapsed(true), ms);
    return () => window.clearTimeout(timer);
  }, [online, remoteSettled, ms]);

  return !online || budgetElapsed;
}
