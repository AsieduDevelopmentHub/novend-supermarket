"use client";

import { Suspense, use } from "react";
import { ReportMetricDetailView } from "@/features/reports/components/metric-detail-view";
import { LoadingState } from "@/components/feedback/loading-state";

export default function ReportMetricPage({
  params,
}: {
  params: Promise<{ metric: string }>;
}) {
  const { metric } = use(params);
  return (
    <Suspense fallback={<LoadingState label="Loading…" />}>
      <ReportMetricDetailView metric={metric} />
    </Suspense>
  );
}
