"use client";

import { useSyncExternalStore } from "react";
import { SALES_WORKING_BRANCH_EVENT, readSalesWorkingBranch } from "@/lib/sales/working-branch";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const notify = () => onStoreChange();
  window.addEventListener("storage", notify);
  window.addEventListener(SALES_WORKING_BRANCH_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(SALES_WORKING_BRANCH_EVENT, notify);
  };
}

/** Admin Sales branch, remembered on this device until they choose another. */
export function usePersistedSalesBranchId(userId: string | null, enabled: boolean): string | null {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => (enabled ? (readSalesWorkingBranch(userId) ?? "") : ""),
    () => "",
  );
  return snapshot || null;
}
