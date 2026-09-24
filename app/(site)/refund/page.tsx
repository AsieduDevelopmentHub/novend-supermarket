import { LegalPolicyPage, legalMetadata } from "@/features/marketing/components/legal-policy-page";
import { sitePages } from "@/features/marketing/site-content";
import { APP_BRAND } from "@/constants/app";

export const metadata = legalMetadata(
  "Refund & Cancellation Policy",
  `Refund and cancellation policy for ${APP_BRAND} by Asiedu Development Hub.`,
  "/refund",
);

export default function RefundPolicyPage() {
  return <LegalPolicyPage content={sitePages.refund} />;
}
