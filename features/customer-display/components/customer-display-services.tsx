"use client";

import { useCustomerDisplayAutoOpen } from "@/features/customer-display/hooks/use-customer-display-auto-open";
import { useCustomerDisplayBrandingSeed } from "@/features/customer-display/hooks/use-customer-display-branding-seed";
import { useDesktopRuntime } from "@/hooks/use-desktop-runtime";
import { useLicense } from "@/hooks/use-license";

/** Desktop-only side effects: dual-monitor auto-open and hotplug for bundled customer display. */
export function CustomerDisplayServices() {
  const isDesktop = useDesktopRuntime();
  const { capabilities } = useLicense();
  const enabled = isDesktop && capabilities.canUseCustomerDisplay;

  useCustomerDisplayBrandingSeed(enabled);
  useCustomerDisplayAutoOpen(enabled);

  return null;
}
