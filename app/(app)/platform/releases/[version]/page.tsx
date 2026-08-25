"use client";

import { use } from "react";
import { PlatformReleaseDetailView } from "@/features/platform/components/platform-release-detail-view";

export default function PlatformReleasePage({ params }: { params: Promise<{ version: string }> }) {
  const { version } = use(params);
  return <PlatformReleaseDetailView version={decodeURIComponent(version)} />;
}
