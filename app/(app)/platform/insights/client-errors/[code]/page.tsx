"use client";

import { use } from "react";
import { PlatformClientErrorDetailView } from "@/features/platform/components/platform-client-error-detail-view";

export default function PlatformClientErrorCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  return <PlatformClientErrorDetailView code={code} />;
}
