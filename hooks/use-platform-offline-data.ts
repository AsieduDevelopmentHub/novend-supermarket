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

/** Skip Super Admin queries until `platform.me` confirms the session is allowed. */
function usePlatformAdminLiveArgs(online: boolean): {} | "skip" {
  const gate = useQuery(api.platform.me, online ? {} : "skip");
  if (!online) return "skip";
  if (gate === undefined) return "skip";
  return gate.isPlatformAdmin ? {} : "skip";
}

/**
 * Live Convex query with an IndexedDB fallback for offline viewing.
 *
 * `key` identifies the current query args (e.g. an organization id or a
 * range filter) so switching between entities doesn't briefly render a
 * stale cache entry that belongs to the previous key.
 *
 * Remember the latest live value across a later disconnect so render
 * can fall back without reading a ref during paint.
 */
function useLiveWithDiskCache<TValue>(
  live: TValue | undefined,
  key: string,
  load: () => Promise<TValue | null>,
  save: (value: TValue) => void | Promise<void>,
): { data: TValue | null | undefined; loading: boolean; source: CacheSource } {
  const [diskCache, setDiskCache] = useState<{ key: string; value: TValue | null } | null>(null);
  const [lastLive, setLastLive] = useState<{ key: string; value: TValue } | null>(null);

  if (live !== undefined) {
    const same = lastLive?.key === key && lastLive.value === live;
    if (!same) {
      setLastLive({ key, value: live });
    }
  }

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
  const liveArgs = usePlatformAdminLiveArgs(online);
  const live = useQuery(api.platform.overview, liveArgs);
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
  const liveArgs = usePlatformAdminLiveArgs(online);
  const live = useQuery(api.platform.listOrganizations, liveArgs);
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
  const liveArgs = usePlatformAdminLiveArgs(online);
  const live = useQuery(
    api.desktopReleases.listRecent,
    liveArgs === "skip" ? "skip" : { channel, limit: 20 },
  );
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
  const liveArgs = usePlatformAdminLiveArgs(online);
  const id = organizationId as Id<"organizations">;
  const live = useQuery(
    api.platform.getOrganization,
    liveArgs === "skip" || !organizationId ? "skip" : { organizationId: id },
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
  const liveArgs = usePlatformAdminLiveArgs(online);
  const live = useQuery(
    api.platformAnalytics.revenueAnalytics,
    liveArgs === "skip" ? "skip" : { range },
  );
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
  const liveArgs = usePlatformAdminLiveArgs(online);
  const live = useQuery(api.platformAnalytics.listSubscriptions, liveArgs);
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
  const liveArgs = usePlatformAdminLiveArgs(online);
  const live = useQuery(api.platformAnalytics.systemHealth, liveArgs);
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
  const liveArgs = usePlatformAdminLiveArgs(online);
  const live = useQuery(
    api.platformMonitoring.dashboard,
    liveArgs === "skip" ? "skip" : { range },
  );
  const typedLive = live as PlatformReportData | undefined;
  const { data, loading, source } = useLiveWithDiskCache(
    typedLive,
    range,
    () => loadPlatformMonitoring(range).then((row) => (row?.payload as PlatformReportData) ?? null),
    (value) => savePlatformMonitoring(range, value),
  );
  return { data, loading, source };
}

export function usePlatformPaymentData(paymentId: string) {
  const online = useConnectivity();
  const liveArgs = usePlatformAdminLiveArgs(online);
  const id = paymentId as Id<"billingHistory">;
  const live = useQuery(
    api.platformAnalytics.getPayment,
    liveArgs === "skip" || !paymentId ? "skip" : { paymentId: id },
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
  const liveArgs = usePlatformAdminLiveArgs(online);
  const live = useQuery(
    api.platformAnalytics.getReleaseBundle,
    liveArgs === "skip" || !version ? "skip" : { version },
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
  const liveArgs = usePlatformAdminLiveArgs(online);
  const live = useQuery(
    api.platformAnalytics.listReleaseBundles,
    liveArgs === "skip" ? "skip" : { channel, limit: 20 },
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
  const liveArgs = usePlatformAdminLiveArgs(online);
  const live = useQuery(
    api.platformAnalytics.getInsightDetail,
    liveArgs === "skip" ? "skip" : { metric, range },
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
  const liveArgs = usePlatformAdminLiveArgs(online);
  const live = useQuery(api.platformAnalytics.listOperatingCosts, liveArgs);
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
