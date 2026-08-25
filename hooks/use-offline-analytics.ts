"use client";

import { useEffect, useState } from "react";
import {
  buildLocalAnalyticsSummary,
  type AnalyticsGranularity,
  type LocalAnalyticsSummary,
} from "@/lib/offline/analytics-engine";

type OfflineAnalyticsState = {
  key: string;
  summary: LocalAnalyticsSummary | null;
  loading: boolean;
};

/**
 * Local P&L summary from Dexie. Disabled state is derived (no sync setState in effects).
 */
export function useOfflineAnalytics(
  range: { startDate: number; endDate: number } | null,
  granularity: AnalyticsGranularity,
  branchId: string | null | undefined,
  enabled: boolean,
) {
  const requestKey =
    enabled && range
      ? `${range.startDate}:${range.endDate}:${granularity}:${branchId ?? "all"}`
      : "";

  const [state, setState] = useState<OfflineAnalyticsState>({
    key: "",
    summary: null,
    loading: false,
  });

  useEffect(() => {
    if (!requestKey || !range) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setState((prev) =>
        prev.key === requestKey && prev.loading
          ? prev
          : { key: requestKey, summary: null, loading: true },
      );
    });

    void buildLocalAnalyticsSummary({
      startDate: range.startDate,
      endDate: range.endDate,
      granularity,
      branchId: branchId ?? null,
    }).then((summary) => {
      if (cancelled) return;
      setState({ key: requestKey, summary, loading: false });
    });

    return () => {
      cancelled = true;
    };
  }, [requestKey, range, granularity, branchId]);

  if (!enabled || !range) {
    return { summary: null, loading: false };
  }

  if (state.key !== requestKey || state.loading) {
    return { summary: undefined, loading: true };
  }

  // Empty Dexie still settles (summary may be a zeroed object).
  return { summary: state.summary ?? undefined, loading: false };
}
