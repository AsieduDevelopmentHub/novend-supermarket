"use client";

import { useEffect, useState } from "react";

/** Live trust animation phases for the offline architecture section. */
export type ArchitectureSyncPhase =
  "idle" | "sale" | "local" | "pending" | "reconnect" | "syncing" | "synced" | "dashboard";

const PHASE_SEQUENCE: ReadonlyArray<{ phase: ArchitectureSyncPhase; ms: number }> = [
  { phase: "idle", ms: 1600 },
  { phase: "sale", ms: 1800 },
  { phase: "local", ms: 2000 },
  { phase: "pending", ms: 2200 },
  { phase: "reconnect", ms: 1800 },
  { phase: "syncing", ms: 2600 },
  { phase: "synced", ms: 2000 },
  { phase: "dashboard", ms: 2400 },
];

/** ~16s calm loop. Disabled when prefers-reduced-motion. */
export function useArchitectureSyncCycle() {
  const [phase, setPhase] = useState<ArchitectureSyncPhase>(() => {
    if (typeof window === "undefined") return "idle";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "synced";
    return "idle";
  });
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let timeoutId = 0;
    let step = 0;

    const run = () => {
      if (cancelled) return;
      const current = PHASE_SEQUENCE[step];
      if (!current) return;
      setPhase(current.phase);
      timeoutId = window.setTimeout(() => {
        step += 1;
        if (step >= PHASE_SEQUENCE.length) {
          step = 0;
          setCycle((value) => value + 1);
        }
        run();
      }, current.ms);
    };

    run();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return { phase, cycle };
}

export function architectureActiveNode(
  phase: ArchitectureSyncPhase,
): "device" | "local" | "sync" | "dashboard" | null {
  switch (phase) {
    case "sale":
      return "device";
    case "local":
    case "pending":
      return "local";
    case "reconnect":
    case "syncing":
    case "synced":
      return "sync";
    case "dashboard":
      return "dashboard";
    default:
      return null;
  }
}
