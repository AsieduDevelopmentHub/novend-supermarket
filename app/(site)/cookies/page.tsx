import { LegalPolicyPage, legalMetadata } from "@/features/marketing/components/legal-policy-page";
import { sitePages } from "@/features/marketing/site-content";
import { APP_BRAND } from "@/constants/app";

export const metadata = legalMetadata(
  "Cookie Policy",
  `Cookie Policy for ${APP_BRAND} by Asiedu Development Hub.`,
  "/cookies",
);

export default function CookiePolicyPage() {
  return <LegalPolicyPage content={sitePages.cookies} />;
}
