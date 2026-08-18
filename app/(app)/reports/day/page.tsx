"use client";

import { Suspense } from "react";
import { ReportDayDetailView } from "@/features/reports/components/day-detail-view";
import { LoadingState } from "@/components/feedback/loading-state";

export default function ReportDayPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading…" />}>
      <ReportDayDetailView />
    </Suspense>
  );
}
