"use client";

import { useSyncExternalStore } from "react";
import { getDeviceFingerprint } from "@/lib/device";

function subscribe() {
  return () => {};
}

/** Client-only fingerprint. Empty during SSR so hydration does not cache a blank useMemo. */
export function useDeviceFingerprint() {
  return useSyncExternalStore(subscribe, getDeviceFingerprint, () => "");
}
