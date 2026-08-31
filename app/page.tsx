import type { Metadata } from "next";
import { LandingPage } from "@/features/marketing/components/landing-page";
import { APP_BRAND, APP_NAME } from "@/constants/app";

export const metadata: Metadata = {
  title: `${APP_BRAND} — Offline-first POS for modern business`,
  description:
    "Novend is the commercial offline-first Point of Sale for Ghanaian shops, pharmacies, wholesalers, and multi-branch retailers — with desktop, Android, iOS PWA, and cloud sync.",
  openGraph: {
    title: `${APP_NAME} — Smart POS. Strong business.`,
    description:
      "Offline-first Point of Sale for independent businesses. Built for Ghana. Ready for growth.",
  },
};

export default function HomePage() {
  return <LandingPage />;
}
