"use client";

import { useEffect, useState } from "react";
import {
  buildLocalAnalyticsDetails,
  type AnalyticsDetailMetric,
  type LocalAnalyticsDetails,
} from "@/lib/offline/analytics-engine";
import { useOfflineStatus } from "@/providers/offline-provider";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";

type OfflineDetailsState = {
  key: string;
  details: LocalAnalyticsDetails | null;
  loading: boolean;
};

export function useOfflineAnalyticsDetails(
  metric: AnalyticsDetailMetric,
  range: { startDate: number; endDate: number } | null,
  branchId: string | null | undefined,
  enabled: boolean,
) {
  const { lastSyncAt } = useOfflineStatus();
  const requestKey =
    enabled && range
      ? `${metric}:${range.startDate}:${range.endDate}:${branchId ?? "all"}`
      : "";

  const [state, setState] = useState<OfflineDetailsState>({
    key: "",
    details: null,
    loading: false,
  });

  useEffect(() => {
    if (!requestKey || !range) return;

    let cancelled = false;
    const load = () => {
      queueMicrotask(() => {
        if (cancelled) return;
        setState((prev) =>
          prev.key === requestKey && prev.loading
            ? prev
            : { key: requestKey, details: null, loading: true },
        );
      });

      void buildLocalAnalyticsDetails({
        metric,
        startDate: range.startDate,
        endDate: range.endDate,
        branchId: branchId ?? null,
      }).then((details) => {
        if (cancelled) return;
        setState({ key: requestKey, details, loading: false });
      });
    };

    load();
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [requestKey, range, metric, branchId, lastSyncAt]);

  if (!enabled || !range) {
    return { details: null, loading: false };
  }

  if (state.key !== requestKey || state.loading) {
    return { details: undefined, loading: true };
  }

  return { details: state.details ?? undefined, loading: false };
}
