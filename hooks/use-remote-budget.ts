"use client";

import { useEffect, useState } from "react";

const DEFAULT_REMOTE_BUDGET_MS = 2500;

/**
 * After `active` stays true for `ms`, flip to true so UI can fall back to
 * local/empty instead of an infinite skeleton (Cap often reports online while
 * Convex never resolves).
 */
export function useRemoteBudget(active: boolean, ms = DEFAULT_REMOTE_BUDGET_MS): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) {
      queueMicrotask(() => setElapsed(false));
      return;
    }
    const timer = window.setTimeout(() => setElapsed(true), ms);
    return () => window.clearTimeout(timer);
  }, [active, ms]);

  return elapsed;
}
