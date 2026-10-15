import type { Metadata } from "next";
import { LoginPageChrome } from "@/features/auth/components/login-page-chrome";
import { LoginSessionGate } from "@/features/auth/components/login-session-gate";
import { APP_NAME } from "@/constants/app";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Sign in",
  description: `Sign in to ${APP_NAME} to sell, manage inventory, and run the till fully offline.`,
  path: "/login",
});

/**
 * Login — mobile hero + overlapping sheet, desktop split card.
 * Session gate is an escape hatch only; credential leave owns navigation.
 */
export default function LoginPage() {
  return (
    <LoginSessionGate>
      <LoginPageChrome />
    </LoginSessionGate>
  );
}
