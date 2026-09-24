import { LegalPolicyPage, legalMetadata } from "@/features/marketing/components/legal-policy-page";
import { sitePages } from "@/features/marketing/site-content";
import { APP_BRAND } from "@/constants/app";

export const metadata = legalMetadata(
  "Privacy Policy",
  `Privacy Policy for ${APP_BRAND} by Asiedu Development Hub.`,
  "/privacy",
);

export default function PrivacyPage() {
  return <LegalPolicyPage content={sitePages.privacy} />;
}
