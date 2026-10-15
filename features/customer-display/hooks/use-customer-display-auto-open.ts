"use client";

import { useEffect, useRef } from "react";
import { readCustomerDisplayPrefs } from "@/lib/sales/customer-display";
import { getDesktopBridge } from "@/lib/desktop";
import { hasSecondaryDisplay } from "@/lib/desktop/customer-display-policy";

async function tryOpenCustomerDisplay() {
  const bridge = getDesktopBridge();
  if (!bridge?.openCustomerDisplay || !bridge.listDisplays) return;

  const [displaysResult, status] = await Promise.all([
    bridge.listDisplays(),
    bridge.getCustomerDisplayStatus?.() ?? Promise.resolve({ open: false, displayId: null }),
  ]);

  if (!displaysResult.ok || !hasSecondaryDisplay(displaysResult.displays.length)) return;
  if (status.open) return;

  const prefs = readCustomerDisplayPrefs();
  const preferred = prefs.preferredDisplayId;
  const preferredStillValid =
    preferred != null &&
    displaysResult.displays.some((display) => display.id === preferred && !display.isPrimary);

  await bridge.openCustomerDisplay({
    displayId: preferredStillValid ? preferred : null,
  });
}

/**
 * Enables Electron auto-open on dual monitors and opens the bundled customer display
 * when a second screen is present (launch + hotplug).
 */
export function useCustomerDisplayAutoOpen(enabled: boolean) {
  const armedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      armedRef.current = false;
      const bridge = getDesktopBridge();
      void bridge?.setCustomerDisplayAutoOpen?.(false);
      return;
    }

    const bridge = getDesktopBridge();
    if (!bridge?.setCustomerDisplayAutoOpen || !bridge.openCustomerDisplay) return;

    if (!armedRef.current) {
      armedRef.current = true;
      void bridge.setCustomerDisplayAutoOpen(true);
      void tryOpenCustomerDisplay();
    }

    const offDisplays = bridge.onDisplaysChanged?.(() => {
      void tryOpenCustomerDisplay();
    });

    return () => {
      offDisplays?.();
    };
  }, [enabled]);
}
