"use client";

import { useEffect, useState } from "react";
import {
  buildLocalAnalyticsSummary,
  type AnalyticsGranularity,
  type LocalAnalyticsSummary,
} from "@/lib/offline/analytics-engine";

export function useOfflineAnalytics(
  range: { startDate: number; endDate: number } | null,
  granularity: AnalyticsGranularity,
  branchId: string | null | undefined,
  enabled: boolean,
) {
  const [data, setData] = useState<LocalAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !range) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void buildLocalAnalyticsSummary({
      startDate: range.startDate,
      endDate: range.endDate,
      granularity,
      branchId: branchId ?? null,
    })
      .then((summary) => {
        if (!cancelled) setData(summary);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, range, granularity, branchId]);

  if (!enabled) return { summary: null, loading: false };
  if (loading && !data) return { summary: undefined, loading: true };
  return { summary: data, loading };
}
