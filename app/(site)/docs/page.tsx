import type { Metadata } from "next";
import { DocsGuide } from "@/features/marketing/components/docs-guide";
import { APP_BRAND } from "@/constants/app";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Documentation",
  description: `Learn how to run ${APP_BRAND} — illustrated guides for offline POS, inventory, sync, hardware, analytics, and multi-branch operations.`,
  path: "/docs",
});

export default function DocsPage() {
  return <DocsGuide />;
}
