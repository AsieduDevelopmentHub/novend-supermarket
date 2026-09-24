import { LegalPolicyPage, legalMetadata } from "@/features/marketing/components/legal-policy-page";
import { sitePages } from "@/features/marketing/site-content";
import { APP_BRAND } from "@/constants/app";

export const metadata = legalMetadata(
  "Terms of Service",
  `Terms of Service for ${APP_BRAND} by Asiedu Development Hub.`,
  "/terms",
);

export default function TermsPage() {
  return <LegalPolicyPage content={sitePages.terms} />;
}
