"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  loadPlatformOrgDetail,
  loadPlatformOrganizations,
  loadPlatformOverview,
  loadPlatformReleases,
  savePlatformOrgDetail,
  savePlatformOrganizations,
  savePlatformOverview,
  savePlatformReleases,
  type PlatformOrganizationListItem,
  type PlatformOverviewCache,
  type PlatformReleaseCacheItem,
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
