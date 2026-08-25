"use client";

import { Suspense, use } from "react";
import { AnalyticsMetricDetailView } from "@/features/analytics/components/metric-detail-view";
import { LoadingState } from "@/components/feedback/loading-state";

export default function AnalyticsMetricPage({ params }: { params: Promise<{ metric: string }> }) {
  const { metric } = use(params);
  return (
    <Suspense fallback={<LoadingState label="Loading…" />}>
      <AnalyticsMetricDetailView metric={metric} />
    </Suspense>
  );
}
