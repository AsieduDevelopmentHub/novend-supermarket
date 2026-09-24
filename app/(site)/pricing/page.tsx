import type { Metadata } from "next";
import { PricingPageView } from "@/features/marketing/components/pricing-page-view";
import { APP_BRAND, APP_NAME } from "@/constants/app";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing",
  description: `Compare ${APP_NAME} plans — Basic, Pro, Enterprise, and Lifetime. Offline POS after setup, inventory, and sync. No account required. ${APP_BRAND}.`,
  path: "/pricing",
});

export default function PricingPage() {
  return <PricingPageView />;
}
