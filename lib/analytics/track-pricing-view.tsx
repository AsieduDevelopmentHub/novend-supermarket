"use client";

import { useEffect } from "react";
import { trackGaEvent } from "@/lib/analytics/ga-events";

/** Fires once when the public pricing page is shown. */
export function TrackPricingView() {
  useEffect(() => {
    trackGaEvent("pricing_view");
  }, []);
  return null;
}
