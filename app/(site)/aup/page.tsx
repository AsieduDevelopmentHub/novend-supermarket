import { LegalPolicyPage, legalMetadata } from "@/features/marketing/components/legal-policy-page";
import { sitePages } from "@/features/marketing/site-content";
import { APP_BRAND } from "@/constants/app";

export const metadata = legalMetadata(
  "Acceptable Use Policy",
  `Acceptable Use Policy for ${APP_BRAND} by Asiedu Development Hub.`,
);

export default function AcceptableUsePage() {
  return <LegalPolicyPage content={sitePages.aup} />;
}
