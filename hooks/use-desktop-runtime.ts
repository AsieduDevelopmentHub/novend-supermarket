"use client";

import { useSyncExternalStore } from "react";
import { isDesktopRuntime } from "@/lib/desktop";

/** The bridge is injected before page load, so the value never changes at runtime. */
function subscribe() {
  return () => {};
}

/**
 * True only inside the Electron desktop shell.
 * Returns false during SSR and the first hydration pass, then settles on the client.
 */
export function useDesktopRuntime(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isDesktopRuntime(),
    () => false,
  );
}
