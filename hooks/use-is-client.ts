"use client";

import { useSyncExternalStore } from "react";

function subscribeNoop() {
  return () => {};
}

/** True after hydration. SSR and the first client render stay false. */
export function useIsClient() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}
