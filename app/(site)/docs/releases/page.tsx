import type { Metadata } from "next";
import { ReleasesView } from "@/features/marketing/components/releases-view";
import { APP_BRAND } from "@/constants/app";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Release Notes",
  description: `Product updates and release notes for ${APP_BRAND}.`,
  path: "/docs/releases",
});

export default function ReleasesPage() {
  return <ReleasesView />;
}
