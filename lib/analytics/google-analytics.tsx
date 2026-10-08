"use client";

import { useEffect } from "react";
import Script from "next/script";
import { gaMeasurementId, installGaClickTracking } from "@/lib/analytics/ga-events";

/**
 * Google Analytics 4 page views for the public marketing site.
 * Funnel events (signup, trial, downloads, …) are sent via `trackGaEvent`
 * and do not include till activity or personal data.
 * Set NEXT_PUBLIC_GA_MEASUREMENT_ID (G-…). Leave unset to disable.
 */
export function GoogleAnalytics() {
  const measurementId = gaMeasurementId();

  useEffect(() => {
    installGaClickTracking();
  }, []);

  if (!measurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="novend-ga4" strategy="afterInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}', { anonymize_ip: true });
window.__novendGaConfigured = true;
`}
      </Script>
    </>
  );
}
