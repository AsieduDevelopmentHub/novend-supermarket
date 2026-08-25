"use client";

import { use } from "react";
import { PlatformInsightDetailView } from "@/features/platform/components/platform-insight-detail-view";
import type { PlatformInsightMetric } from "@/convex/platformAnalytics";

export default function PlatformInsightPage({ params }: { params: Promise<{ metric: string }> }) {
  const { metric } = use(params);
  return <PlatformInsightDetailView metric={metric as PlatformInsightMetric} />;
}
