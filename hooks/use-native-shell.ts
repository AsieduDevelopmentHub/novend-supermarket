"use client";

import { useSyncExternalStore } from "react";
import { isCapacitor } from "@novend/hardware";

const listeners = new Set<() => void>();
let pollTimer: number | null = null;

function emitChange() {
  for (const listener of listeners) listener();
}

function ensureBridgePoll() {
  if (typeof window === "undefined" || pollTimer) return;
  const stopAt = Date.now() + 3000;
  pollTimer = window.setInterval(() => {
    if (isCapacitor()) {
      emitChange();
      if (pollTimer) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
      return;
    }
    if (Date.now() > stopAt && pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }, 50);
  window.addEventListener("load", emitChange, { once: true });
}

/**
 * True when running inside the Capacitor Android/iOS shell.
 * SSR and web/Electron always false — desktop sidebar stays unchanged.
 *
 * Polls briefly on mount because the native bridge can attach after the first
 * paint when loading a remote `server.url` (same pattern as Electron preload).
 */
export function useNativeShell(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      ensureBridgePoll();
      // Sync once immediately — bridge is often already present.
      queueMicrotask(() => {
        if (isCapacitor()) onStoreChange();
      });
      return () => listeners.delete(onStoreChange);
    },
    () => isCapacitor(),
    () => false,
  );
}
