"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  dequeuePlatformCostDraft,
  enqueuePlatformCostDraft,
  loadPlatformCostDraftQueue,
  loadPlatformHealth,
  loadPlatformOperatingCosts,
  loadPlatformOrgDetail,
  loadPlatformOrganizations,
  loadPlatformOverview,
  loadPlatformPayment,
  loadPlatformReleaseBundle,
  loadPlatformReleases,
  loadPlatformRevenue,
  loadPlatformSubscriptions,
  savePlatformHealth,
  savePlatformOperatingCosts,
  savePlatformOrgDetail,
  savePlatformOrganizations,
  savePlatformOverview,
  savePlatformPayment,
  savePlatformReleaseBundle,
  savePlatformReleases,
  savePlatformRevenue,
  savePlatformSubscriptions,
  type PlatformCostDraft,
  type PlatformOperatingCostRow,
  type PlatformOrganizationListItem,
  type PlatformOverviewCache,
  type PlatformReleaseCacheItem,
  type PlatformRevenueRange,
} from "@/lib/offline/platform-cache";

type CacheSource = "live" | "cache";

export function usePlatformOverviewData() {
  const online = useConnectivity();
  const live = useQuery(api.platform.overview, online ? {} : "skip");
  const [cached, setCached] = useState<PlatformOverviewCache | null>(null);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPlatformOverview().then((row) => {
      if (cancelled) return;
      setCached(row);
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!live) return;
    setCached({ ...live, cachedAt: Date.now() });
    void savePlatformOverview(live);
  }, [live]);

  if (live) {
    return {
      data: { ...live, cachedAt: cached?.cachedAt ?? Date.now() },
      loading: false,
      source: "live" as CacheSource,
    };
  }
  if (cached) {
    return { data: cached, loading: false, source: "cache" as CacheSource };
  }
  return { data: null, loading: !cacheReady || online, source: "cache" as CacheSource };
}

export function usePlatformOrganizationsData() {
  const online = useConnectivity();
  const live = useQuery(api.platform.listOrganizations, online ? {} : "skip");
  const [cached, setCached] = useState<PlatformOrganizationListItem[] | null>(null);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPlatformOrganizations().then((row) => {
      if (cancelled) return;
      setCached(row?.organizations ?? null);
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!live) return;
    setCached(live);
    void savePlatformOrganizations(live);
  }, [live]);

  if (live) {
    return { data: live, loading: false, source: "live" as CacheSource };
  }
  if (cached) {
    return { data: cached, loading: false, source: "cache" as CacheSource };
  }
  return { data: null, loading: !cacheReady || online, source: "cache" as CacheSource };
}

export function usePlatformReleasesData(channel: "stable" | "beta" = "stable") {
  const online = useConnectivity();
  const live = useQuery(api.desktopReleases.listRecent, online ? { channel, limit: 20 } : "skip");
  const [cached, setCached] = useState<PlatformReleaseCacheItem[] | null>(null);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPlatformReleases().then((row) => {
      if (cancelled) return;
      if (row && row.channel === channel) {
        setCached(row.releases);
      }
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [channel]);

  useEffect(() => {
    if (!live) return;
    const releases: PlatformReleaseCacheItem[] = live.map((row) => ({
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
    setCached(releases);
    void savePlatformReleases(channel, releases);
  }, [live, channel]);

  if (live) {
    return { data: live, loading: false, source: "live" as CacheSource };
  }
  if (cached) {
    return { data: cached, loading: false, source: "cache" as CacheSource };
  }
  return { data: null, loading: !cacheReady || online, source: "cache" as CacheSource };
}

export function usePlatformOrgDetailData(organizationId: string) {
  const online = useConnectivity();
  const id = organizationId as Id<"organizations">;
  const live = useQuery(
    api.platform.getOrganization,
    online && organizationId ? { organizationId: id } : "skip",
  );
  const [cached, setCached] = useState<typeof live>(undefined);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCacheReady(false);
    void loadPlatformOrgDetail(organizationId).then((row) => {
      if (cancelled) return;
      setCached(row ? (row.payload as typeof live) : null);
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    if (live === undefined) return;
    setCached(live);
    if (live) {
      void savePlatformOrgDetail(organizationId, live);
    }
  }, [live, organizationId]);

  if (live !== undefined) {
    return { data: live, loading: false, source: "live" as CacheSource };
  }
  if (cacheReady) {
    return { data: cached ?? null, loading: false, source: "cache" as CacheSource };
  }
  return { data: undefined, loading: true, source: "cache" as CacheSource };
}

export function usePlatformRevenueData(range: PlatformRevenueRange) {
  const online = useConnectivity();
  const live = useQuery(
    api.platformAnalytics.revenueAnalytics,
    online ? { range } : "skip",
  );
  const [cached, setCached] = useState<typeof live>(undefined);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCacheReady(false);
    void loadPlatformRevenue(range).then((row) => {
      if (cancelled) return;
      setCached(row ? (row.payload as typeof live) : undefined);
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [range]);

  useEffect(() => {
    if (live === undefined) return;
    setCached(live);
    void savePlatformRevenue(range, live);
  }, [live, range]);

  if (live !== undefined) {
    return { data: live, loading: false, source: "live" as CacheSource };
  }
  if (cacheReady) {
    return {
      data: (cached as typeof live) ?? null,
      loading: false,
      source: "cache" as CacheSource,
    };
  }
  return { data: undefined, loading: true, source: "cache" as CacheSource };
}

export function usePlatformSubscriptionsData() {
  const online = useConnectivity();
  const live = useQuery(api.platformAnalytics.listSubscriptions, online ? {} : "skip");
  const [cached, setCached] = useState<typeof live>(undefined);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPlatformSubscriptions().then((row) => {
      if (cancelled) return;
      setCached(row ? (row.rows as typeof live) : undefined);
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (live === undefined) return;
    setCached(live);
    void savePlatformSubscriptions(live);
  }, [live]);

  if (live !== undefined) {
    return { data: live, loading: false, source: "live" as CacheSource };
  }
  if (cacheReady) {
    return {
      data: (cached as typeof live) ?? null,
      loading: false,
      source: "cache" as CacheSource,
    };
  }
  return { data: undefined, loading: true, source: "cache" as CacheSource };
}

export function usePlatformHealthData() {
  const online = useConnectivity();
  const live = useQuery(api.platformAnalytics.systemHealth, online ? {} : "skip");
  const [cached, setCached] = useState<typeof live>(undefined);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPlatformHealth().then((row) => {
      if (cancelled) return;
      setCached(row ? (row.payload as typeof live) : undefined);
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (live === undefined) return;
    setCached(live);
    void savePlatformHealth(live);
  }, [live]);

  if (live !== undefined) {
    return { data: live, loading: false, source: "live" as CacheSource };
  }
  if (cacheReady) {
    return {
      data: (cached as typeof live) ?? null,
      loading: false,
      source: "cache" as CacheSource,
    };
  }
  return { data: undefined, loading: true, source: "cache" as CacheSource };
}

export function usePlatformPaymentData(paymentId: string) {
  const online = useConnectivity();
  const id = paymentId as Id<"billingHistory">;
  const live = useQuery(
    api.platformAnalytics.getPayment,
    online && paymentId ? { paymentId: id } : "skip",
  );
  const [cached, setCached] = useState<typeof live>(undefined);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCacheReady(false);
    void loadPlatformPayment(paymentId).then((row) => {
      if (cancelled) return;
      setCached(row ? (row.payload as typeof live) : null);
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  useEffect(() => {
    if (live === undefined) return;
    setCached(live);
    if (live) void savePlatformPayment(paymentId, live);
  }, [live, paymentId]);

  if (live !== undefined) {
    return { data: live, loading: false, source: "live" as CacheSource };
  }
  if (cacheReady) {
    return { data: cached ?? null, loading: false, source: "cache" as CacheSource };
  }
  return { data: undefined, loading: true, source: "cache" as CacheSource };
}

export function usePlatformReleaseBundleData(version: string) {
  const online = useConnectivity();
  const live = useQuery(
    api.platformAnalytics.getReleaseBundle,
    online && version ? { version } : "skip",
  );
  const [cached, setCached] = useState<typeof live>(undefined);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCacheReady(false);
    void loadPlatformReleaseBundle(version).then((row) => {
      if (cancelled) return;
      setCached(row ? (row.payload as typeof live) : null);
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    if (live === undefined) return;
    setCached(live);
    if (live) void savePlatformReleaseBundle(version, live);
  }, [live, version]);

  if (live !== undefined) {
    return { data: live, loading: false, source: "live" as CacheSource };
  }
  if (cacheReady) {
    return { data: cached ?? null, loading: false, source: "cache" as CacheSource };
  }
  return { data: undefined, loading: true, source: "cache" as CacheSource };
}

function newDraftId() {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function usePlatformOperatingCostsData() {
  const online = useConnectivity();
  const live = useQuery(api.platformAnalytics.listOperatingCosts, online ? {} : "skip");
  const createCost = useMutation(api.platformAnalytics.createOperatingCost);
  const removeCost = useMutation(api.platformAnalytics.removeOperatingCost);
  const [rows, setRows] = useState<PlatformOperatingCostRow[] | null>(null);
  const [cacheReady, setCacheReady] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const flushLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadPlatformOperatingCosts().then((row) => {
      if (cancelled) return;
      setRows(row?.rows ?? null);
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (live === undefined) return;
    const next: PlatformOperatingCostRow[] = live.map((row) => ({
      id: String(row.id),
      amount: row.amount,
      currency: row.currency,
      category: row.category,
      occurredAt: row.occurredAt,
      description: row.description,
      createdAt: row.createdAt,
    }));
    setRows(next);
    void savePlatformOperatingCosts(next);
  }, [live]);

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
          | "hosting"
          | "convex"
          | "vercel"
          | "domains"
          | "sms"
          | "email"
          | "infrastructure"
          | "misc",
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
    setRows(next);
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
      setRows(next);
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
    setRows(next);
    await savePlatformOperatingCosts(next);
    return { queued: true as const };
  }

  if (live !== undefined || rows) {
    return {
      data: rows ?? [],
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
