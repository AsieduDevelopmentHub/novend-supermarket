"use client";

import { useEffect, useRef } from "react";
import { readCustomerDisplayPrefs } from "@/lib/sales/customer-display";
import { getDesktopBridge } from "@/lib/desktop";

/** Open the customer display on desktop launch when the user enabled auto-open. */
export function useCustomerDisplayAutoOpen(enabled: boolean) {
  const openedRef = useRef(false);

  useEffect(() => {
    if (!enabled || openedRef.current) return;
    const bridge = getDesktopBridge();
    if (!bridge?.openCustomerDisplay) return;

    const prefs = readCustomerDisplayPrefs();
    if (!prefs.autoOpen) return;

    openedRef.current = true;
    void bridge.openCustomerDisplay({ displayId: prefs.preferredDisplayId });
  }, [enabled]);
}
