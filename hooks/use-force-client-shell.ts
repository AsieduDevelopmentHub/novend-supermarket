"use client";

import { useEffect, useState } from "react";
import { useConnectivity } from "@/hooks/use-connectivity";
import { isCapacitor } from "@novend/hardware";

/**
 * True when the authenticated shell should render Dexie-backed client views
 * instead of waiting on Next RSC / Convex soft navigation.
 *
 * Capacitor always uses client views — WebView + RSC soft nav is unreliable
 * offline and under flaky cellular. Web/Electron use client views when offline
 * or after a short “false online” budget.
 */
export function useForceClientShell(budgetMs = 2500): boolean {
  const online = useConnectivity();
  const [budgetElapsed, setBudgetElapsed] = useState(false);
  // Sync on client — do not wait a paint; Cap RSC children often never resolve.
  const nativeShell = typeof window !== "undefined" && isCapacitor();

  useEffect(() => {
    if (!online || nativeShell) {
      queueMicrotask(() => setBudgetElapsed(false));
      return;
    }
    const timer = window.setTimeout(() => setBudgetElapsed(true), budgetMs);
    return () => window.clearTimeout(timer);
  }, [online, nativeShell, budgetMs]);

  return nativeShell || !online || budgetElapsed;
}
