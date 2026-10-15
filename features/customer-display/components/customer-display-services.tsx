"use client";

import { useCustomerDisplayAutoOpen } from "@/features/customer-display/hooks/use-customer-display-auto-open";
import { useCustomerDisplayBrandingSeed } from "@/features/customer-display/hooks/use-customer-display-branding-seed";
import { useDesktopRuntime } from "@/hooks/use-desktop-runtime";
import { useLicense } from "@/hooks/use-license";
import { FULLY_OFFLINE } from "@/constants/runtime";

/** Desktop-only side effects: dual-monitor auto-open and hotplug for bundled customer display. */
export function CustomerDisplayServices() {
  const isDesktop = useDesktopRuntime();
  const { capabilities } = useLicense();
  // Millie's is a single paid till — customer display is always entitled offline.
  const enabled = isDesktop && (FULLY_OFFLINE || capabilities.canUseCustomerDisplay);

  useCustomerDisplayBrandingSeed(enabled);
  useCustomerDisplayAutoOpen(enabled);

  return null;
}
