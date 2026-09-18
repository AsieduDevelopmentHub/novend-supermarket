import { LegalPolicyPage, legalMetadata } from "@/features/marketing/components/legal-policy-page";
import { sitePages } from "@/features/marketing/site-content";
import { APP_BRAND } from "@/constants/app";

export const metadata = legalMetadata(
  "Data Processing Addendum",
  `Data Processing Addendum for ${APP_BRAND} by Asiedu Development Hub.`,
);

export default function DataProcessingAddendumPage() {
  return <LegalPolicyPage content={sitePages.dpa} />;
}
