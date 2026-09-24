import type { Metadata } from "next";
import { LandingPage } from "@/features/marketing/components/landing-page";
import { landingCopy } from "@/features/marketing/content";
import { APP_BRAND } from "@/constants/app";
import { JsonLd, buildPageMetadata, landingStructuredData } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: `${APP_BRAND} — Offline-first POS for modern business`,
  description:
    "Novend is the commercial offline-first Point of Sale for shops, pharmacies, wholesalers, and multi-branch retailers — with desktop, Android, iOS PWA, and cloud sync.",
  path: "/",
  absoluteTitle: true,
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={landingStructuredData(landingCopy.faq.items)} />
      <LandingPage />
    </>
  );
}
