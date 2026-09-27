import type { Metadata } from "next";
import { DemoPageView } from "@/features/marketing/components/demo-page-view";
import { APP_BRAND, APP_NAME } from "@/constants/app";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Product demo & training",
  description: `Watch the complete ${APP_NAME} training, then jump into per-action module clips. ${APP_BRAND}.`,
  path: "/demo",
});

export default function DemoPage() {
  return <DemoPageView />;
}
