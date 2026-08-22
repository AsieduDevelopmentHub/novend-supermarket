import type { Metadata } from "next";
import { ReleasesView } from "@/features/marketing/components/releases-view";
import { APP_BRAND } from "@/constants/app";

export const metadata: Metadata = {
  title: "Release Notes",
  description: `Product updates and release notes for ${APP_BRAND}, synced from the live Convex release feed.`,
};

export default function ReleasesPage() {
  return <ReleasesView />;
}
