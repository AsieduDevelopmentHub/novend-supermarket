"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  dequeuePlatformCostDraft,
  enqueuePlatformCostDraft,
  loadPlatformCostDraftQueue,
  loadPlatformHealth,
  loadPlatformInsight,
  loadPlatformOperatingCosts,
  loadPlatformMonitoring,
  loadPlatformOrgDetail,
  loadPlatformOrganizations,
  loadPlatformOverview,
  loadPlatformPayment,
  loadPlatformReleaseBundle,
  loadPlatformReleaseBundles,
  loadPlatformReleases,
  loadPlatformRevenue,
  loadPlatformSubscriptions,
  savePlatformHealth,
  savePlatformInsight,
  savePlatformOperatingCosts,
  savePlatformMonitoring,
  savePlatformOrgDetail,
  savePlatformOrganizations,
  savePlatformOverview,
  savePlatformPayment,
  savePlatformReleaseBundle,
  savePlatformReleaseBundles,
  savePlatformReleases,
  savePlatformRevenue,
  savePlatformSubscriptions,
  type PlatformCostDraft,
  type PlatformOperatingCostRow,
  type PlatformReleaseCacheItem,
  type PlatformRevenueRange,
  type PlatformMonitoringRange,
} from "@/lib/offline/platform-cache";
import type { PlatformReportData } from "@/lib/export/platform";
import type { PlatformInsightMetric } from "@/convex/platformAnalytics";

type CacheSource = "live" | "cache";

/**
 * Live Convex query with an IndexedDB fallback for offline viewing.
 *
 * `key` identifies the current query args (e.g. an organization id or a
 * range filter) so switching between entities doesn't briefly render a
 * stale cache entry that belongs to the previous key.
 *
 * Remember the latest live value across a later disconnect with a ref so
 * render never calls setState (React 19 warns when that happens before mount).
 */
function useLiveWithDiskCache<TValue>(
  live: TValue | undefined,
  key: string,
  load: () => Promise<TValue | null>,
  save: (value: TValue) => void | Promise<void>,
): { data: TValue | null | undefined; loading: boolean; source: CacheSource } {
  const [diskCache, setDiskCache] = useState<{ key: string; value: TValue | null } | null>(null);
  const lastLiveRef = useRef<{ key: string; value: TValue } | null>(null);

  if (live !== undefined) {
    lastLiveRef.current = { key, value: live };
  }
  const lastLive = lastLiveRef.current;

  useEffect(() => {
    let cancelled = false;
    void load().then((value) => {
      if (cancelled) return;
      setDiskCache({ key, value });
    });
    return () => {
      cancelled = true;
    };
    // `load` is a fresh closure per render capturing the args behind `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (live === undefined) return;
    void save(live);
    // `save` is a fresh closure per render capturing the args behind `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, key]);

  if (live !== undefined) {
    return { data: live, loading: false, source: "live" };
  }
  if (lastLive && lastLive.key === key) {
    return { data: lastLive.value, loading: false, source: "cache" };
  }
  if (diskCache && diskCache.key === key) {
    return { data: diskCache.value, loading: false, source: "cache" };
  }
  return { data: undefined, loading: true, source: "cache" };
}

export function usePlatformOverviewData() {
  const online = useConnectivity();
  const live = useQuery(api.platform.overview, online ? {} : "skip");
  const { data, loading, source } = useLiveWithDiskCache(
    live,
    "overview",
    () => loadPlatformOverview().then((row) => (row as unknown as typeof live) ?? null),
    (value) => savePlatformOverview(value),
  );
  return { data, loading, source };
}

export function usePlatformOrganizationsData() {
  const online = useConnectivity();
  const live = useQuery(api.platform.listOrganizations, online ? {} : "skip");
  const { data, loading, source } = useLiveWithDiskCache(
    live,
    "organizations",
    () => loadPlatformOrganizations().then((row) => row?.organizations ?? null),
    (value) => savePlatformOrganizations(value),
  );
  return { data, loading, source };
}

export function usePlatformReleasesData(channel: "stable" | "beta" = "stable") {
  const online = useConnectivity();
  const live = useQuery(api.desktopReleases.listRecent, online ? { channel, limit: 20 } : "skip");
  const mapped = useMemo<PlatformReleaseCacheItem[] | undefined>(() => {
    if (!live) return undefined;
    return live.map((row) => ({
      _id: String(row._id),
      version: row.version,
      tag: row.tag,
      channel: row.channel,
      notes: row.notes,
      releasedAt: row.releasedAt,
      mandatory: row.mandatory,
      assets: row.assets.map((asset) => ({
        githubAssetId: asset.githubAssetId,
        fileName: asset.fileName,
        platform: asset.platform,
        arch: asset.arch,
        size: asset.size,
        downloadUrl: asset.downloadUrl,
      })),
    }));
  }, [live]);
  const { data, loading, source } = useLiveWithDiskCache(
    mapped,
    channel,
    () => loadPlatformReleases().then((row) => (row?.channel === channel ? row.releases : null)),
    (value) => savePlatformReleases(channel, value),
  );
  return { data, loading, source };
}

export function usePlatformOrgDetailData(organizationId: string) {
  const online = useConnectivity();
  const id = organizationId as Id<"organizations">;
  const live = useQuery(
    api.platform.getOrganization,
    online && organizationId ? { organizationId: id } : "skip",
  );
  const { data, loading, source } = useLiveWithDiskCache(
    live,
    organizationId,
    () =>
      loadPlatformOrgDetail(organizationId).then((row) => (row?.payload as typeof live) ?? null),
    (value) => savePlatformOrgDetail(organizationId, value),
  );
  return { data, loading, source };
}

export function usePlatformRevenueData(range: PlatformRevenueRange) {
  const online = useConnectivity();
  const live = useQuery(api.platformAnalytics.revenueAnalytics, online ? { range } : "skip");
  const { data, loading, source } = useLiveWithDiskCache(
    live,
    range,
    () => loadPlatformRevenue(range).then((row) => (row?.payload as typeof live) ?? null),
    (value) => savePlatformRevenue(range, value),
  );
  return { data, loading, source };
}

export function usePlatformSubscriptionsData() {
  const online = useConnectivity();
  const live = useQuery(api.platformAnalytics.listSubscriptions, online ? {} : "skip");
  const { data, loading, source } = useLiveWithDiskCache(
    live,
    "subscriptions",
    () => loadPlatformSubscriptions().then((row) => (row?.rows as typeof live) ?? null),
    (value) => savePlatformSubscriptions(value),
  );
  return { data, loading, source };
}

export function usePlatformHealthData() {
  const online = useConnectivity();
  const live = useQuery(api.platformAnalytics.systemHealth, online ? {} : "skip");
  const { data, loading, source } = useLiveWithDiskCache(
    live,
    "health",
    () => loadPlatformHealth().then((row) => (row?.payload as typeof live) ?? null),
    (value) => savePlatformHealth(value),
  );
  return { data, loading, source };
}

export function usePlatformMonitoringData(range: PlatformMonitoringRange) {
  const online = useConnectivity();
  const live = useQuery(api.platformMonitoring.dashboard, online ? { range } : "skip");
  const typedLive = live as PlatformReportData | undefined;
  const { data, loading, source } = useLiveWithDiskCache(
    typedLive,
    range,
    () =>
      loadPlatformMonitoring(range).then((row) => (row?.payload as PlatformReportData) ?? null),
    (value) => savePlatformMonitoring(range, value),
  );
  return { data, loading, source };
}

export function usePlatformPaymentData(paymentId: string) {
  const online = useConnectivity();
  const id = paymentId as Id<"billingHistory">;
  const live = useQuery(
    api.platformAnalytics.getPayment,
    online && paymentId ? { paymentId: id } : "skip",
  );
  const { data, loading, source } = useLiveWithDiskCache(
    live,
    paymentId,
    () => loadPlatformPayment(paymentId).then((row) => (row?.payload as typeof live) ?? null),
    (value) => savePlatformPayment(paymentId, value),
  );
  return { data, loading, source };
}

export function usePlatformReleaseBundleData(version: string) {
  const online = useConnectivity();
  const live = useQuery(
    api.platformAnalytics.getReleaseBundle,
    online && version ? { version } : "skip",
  );
  const { data, loading, source } = useLiveWithDiskCache(
    live,
    version,
    () => loadPlatformReleaseBundle(version).then((row) => (row?.payload as typeof live) ?? null),
    (value) => savePlatformReleaseBundle(version, value),
  );
  return { data, loading, source };
}

/** Downloads screen — merged desktop + mobile release bundles. */
export function usePlatformReleaseBundlesData(channel: "stable" | "beta" = "stable") {
  const online = useConnectivity();
  const live = useQuery(
    api.platformAnalytics.listReleaseBundles,
    online ? { channel, limit: 20 } : "skip",
  );
  const { data, loading, source } = useLiveWithDiskCache(
    live,
    channel,
    () => loadPlatformReleaseBundles(channel).then((row) => (row?.payload as typeof live) ?? null),
    (value) => savePlatformReleaseBundles(channel, value),
  );
  return { data, loading, source };
}

export function usePlatformInsightData(metric: PlatformInsightMetric, range: PlatformRevenueRange) {
  const online = useConnectivity();
  const live = useQuery(
    api.platformAnalytics.getInsightDetail,
    online ? { metric, range } : "skip",
  );
  const { data, loading, source } = useLiveWithDiskCache(
    live,
    `${metric}:${range}`,
    () => loadPlatformInsight(metric, range).then((row) => (row?.payload as typeof live) ?? null),
    (value) => savePlatformInsight(metric, range, value),
  );
  return { data, loading, source };
}

function newDraftId() {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function usePlatformOperatingCostsData() {
  const online = useConnectivity();
  const live = useQuery(api.platformAnalytics.listOperatingCosts, online ? {} : "skip");
  const createCost = useMutation(api.platformAnalytics.createOperatingCost);
  const removeCost = useMutation(api.platformAnalytics.removeOperatingCost);
  const liveRows = useMemo<PlatformOperatingCostRow[] | undefined>(() => {
    if (live === undefined) return undefined;
    return live.map((row) => ({
      id: String(row.id),
      amount: row.amount,
      currency: row.currency,
      category: row.category,
      occurredAt: row.occurredAt,
      description: row.description,
      createdAt: row.createdAt,
    }));
  }, [live]);
  const [cachedRows, setCachedRows] = useState<PlatformOperatingCostRow[] | null>(null);
  const [cacheReady, setCacheReady] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const flushLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadPlatformOperatingCosts().then((row) => {
      if (cancelled) return;
      setCachedRows(row?.rows ?? null);
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (liveRows === undefined) return;
    void savePlatformOperatingCosts(liveRows);
  }, [liveRows]);

  useEffect(() => {
    if (!online || flushLock.current) return;
    let cancelled = false;

    async function flush() {
      const drafts = await loadPlatformCostDraftQueue();
      if (cancelled || drafts.length === 0) return;
      flushLock.current = true;
      setFlushing(true);
      try {
        for (const draft of drafts) {
          if (cancelled) break;
          if (draft.op === "create") {
            await createCost({
              amount: draft.amount,
              category: draft.category as
                | "hosting"
                | "convex"
                | "vercel"
                | "domains"
                | "sms"
                | "email"
                | "infrastructure"
                | "misc",
              occurredAt: draft.occurredAt,
              description: draft.description,
              currency: draft.currency,
            });
          } else {
            await removeCost({ costId: draft.costId as Id<"platformOperatingCosts"> });
          }
          await dequeuePlatformCostDraft(draft.id);
        }
      } catch {
        /* leave remaining drafts; next reconnect retries */
      } finally {
        flushLock.current = false;
        if (!cancelled) setFlushing(false);
      }
    }

    void flush();
    return () => {
      cancelled = true;
    };
  }, [online, createCost, removeCost, live]);

  const rows = liveRows ?? cachedRows;

  async function queueCreate(input: {
    amount: number;
    category: PlatformOperatingCostRow["category"];
    occurredAt: number;
    description?: string;
  }) {
    if (online) {
      await createCost({
        amount: input.amount,
        category: input.category as
          "hosting" | "convex" | "vercel" | "domains" | "sms" | "email" | "infrastructure" | "misc",
        occurredAt: input.occurredAt,
        description: input.description,
      });
      return { queued: false as const };
    }

    const draft: PlatformCostDraft = {
      id: newDraftId(),
      op: "create",
      amount: input.amount,
      category: input.category,
      occurredAt: input.occurredAt,
      description: input.description,
      createdAt: Date.now(),
    };
    await enqueuePlatformCostDraft(draft);
    const optimistic: PlatformOperatingCostRow = {
      id: draft.id,
      amount: input.amount,
      currency: "GHS",
      category: input.category,
      occurredAt: input.occurredAt,
      description: input.description ?? null,
      createdAt: draft.createdAt,
      pending: true,
    };
    const next = [optimistic, ...(rows ?? [])];
    setCachedRows(next);
    await savePlatformOperatingCosts(next);
    return { queued: true as const };
  }

  async function queueRemove(costId: string) {
    if (online) {
      await removeCost({ costId: costId as Id<"platformOperatingCosts"> });
      return { queued: false as const };
    }

    if (costId.startsWith("draft_")) {
      await dequeuePlatformCostDraft(costId);
      const next = (rows ?? []).filter((row) => row.id !== costId);
      setCachedRows(next);
      await savePlatformOperatingCosts(next);
      return { queued: true as const };
    }

    const draft: PlatformCostDraft = {
      id: newDraftId(),
      op: "remove",
      costId,
      createdAt: Date.now(),
    };
    await enqueuePlatformCostDraft(draft);
    const next = (rows ?? []).filter((row) => row.id !== costId);
    setCachedRows(next);
    await savePlatformOperatingCosts(next);
    return { queued: true as const };
  }

  if (rows) {
    return {
      data: rows,
      loading: false,
      source: (live !== undefined ? "live" : "cache") as CacheSource,
      queueCreate,
      queueRemove,
      flushing,
    };
  }
  return {
    data: null,
    loading: !cacheReady || online,
    source: "cache" as CacheSource,
    queueCreate,
    queueRemove,
    flushing,
  };
}
