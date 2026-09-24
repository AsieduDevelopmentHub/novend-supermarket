import type { Metadata } from "next";
import { DownloadView } from "@/features/marketing/components/download-view";
import { APP_BRAND, APP_NAME } from "@/constants/app";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Download",
  description: `Download ${APP_NAME} for desktop today, use the web app anywhere, and get mobile builds as they ship — ${APP_BRAND}.`,
  path: "/download",
});

export default function DownloadPage() {
  return <DownloadView />;
}
