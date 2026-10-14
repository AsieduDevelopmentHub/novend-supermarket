"use client";

import { useSyncExternalStore } from "react";
import { FULLY_OFFLINE } from "@/constants/runtime";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getSnapshot() {
  if (FULLY_OFFLINE) return false;
  return navigator.onLine;
}

function getServerSnapshot() {
  if (FULLY_OFFLINE) return false;
  return true;
}

/** Browser online/offline connectivity (navigator.onLine + events). */
export function useConnectivity() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
