"use client";

import { useEffect, useState } from "react";

/** Cinematic phases for the marketing Offline & Sync scene. */
export type OfflineFlowPhase = "offline" | "local" | "reconnect";

const PHASE_SEQUENCE: ReadonlyArray<{ phase: OfflineFlowPhase; ms: number }> = [
  { phase: "offline", ms: 2400 },
  { phase: "local", ms: 2800 },
  { phase: "reconnect", ms: 2600 },
];

/**
 * Cycles offline → local engine → reconnect.
 * Starts after mount to avoid SSR hydration mismatch; respects reduced motion.
 */
export function useOfflineFlowCycle() {
  const [phase, setPhase] = useState<OfflineFlowPhase>("offline");
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      setReducedMotion(true);
      setPhase("local");
      return;
    }

    let cancelled = false;
    let timeoutId = 0;
    let step = 0;

    const run = () => {
      if (cancelled) return;
      const current = PHASE_SEQUENCE[step];
      if (!current) return;
      setPhase(current.phase);
      timeoutId = window.setTimeout(() => {
        step = (step + 1) % PHASE_SEQUENCE.length;
        run();
      }, current.ms);
    };

    run();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return { phase, reducedMotion };
}
