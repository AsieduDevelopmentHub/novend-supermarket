"use client";

import { useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConnectivity } from "@/hooks/use-connectivity";
import { loadLicenseSnapshot, saveLicenseSnapshot } from "@/lib/offline/license";
import type { LicenseAccess, LicenseSnapshot } from "@/convex/shared/licensing";
import { resolvePlan, type PlanKey, type PlanLimits } from "@/convex/shared/plans";
import { planCapabilities, type PlanCapabilities } from "@/convex/shared/capabilities";
import { DEFAULT_CLOUD_MODE, normalizeCloudMode, type CloudMode } from "@/convex/shared/cloudMode";

export type LicenseState = {
  isLoading: boolean;
  planKey: PlanKey;
  planName: string;
  limits: PlanLimits;
  capabilities: PlanCapabilities;
  features: string[];
  access: LicenseAccess;
  /** Cloud usage mode for this organization. Defaults to full_sync. */
  cloudMode: CloudMode;
  /** True when the licence came from the offline cache rather than Convex. */
  fromCache: boolean;
  /** Cached licence that is too old to be trusted for writes. */
  stale: boolean;
  subscription: LicenseSnapshot["subscription"];
  organizationId: string | null;
  pendingClosure: boolean;
  closureEffectiveAt: number | null;
};

const DEFAULT_ACCESS: LicenseAccess = {
  state: "active",
  canRead: true,
  canWrite: true,
  reason: null,
  expiresAt: null,
};

/**
 * The organization's licence, live when connected and cached when not.
 *
 * The server is always the authority — this hook exists so the UI can show the
 * right banners and disable actions before a mutation is rejected.
 */
export function useLicense(): LicenseState {
  const { isAuthenticated } = useConvexAuth();
  const online = useConnectivity();
  const remote = useQuery(api.billing.licenseSnapshot, isAuthenticated && online ? {} : "skip");
  const [cached, setCached] = useState<Awaited<ReturnType<typeof loadLicenseSnapshot>>>(null);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadLicenseSnapshot().then((snapshot) => {
      if (cancelled) return;
      setCached(snapshot);
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!remote) return;
    void saveLicenseSnapshot(remote as LicenseSnapshot);
  }, [remote]);

  if (remote) {
    const plan = resolvePlan(remote.planKey);
    return {
      isLoading: false,
      planKey: plan.key,
      planName: remote.planName,
      limits: remote.limits,
      capabilities: remote.capabilities ?? planCapabilities(plan.key, remote.limits),
      features: remote.features,
      access: remote.access,
      cloudMode: normalizeCloudMode(remote.cloudMode),
      fromCache: false,
      stale: false,
      subscription: remote.subscription,
      organizationId: remote.organizationId,
      pendingClosure: remote.pendingClosure ?? false,
      closureEffectiveAt: remote.closureEffectiveAt ?? null,
    };
  }

  if (!online && cached) {
    const plan = resolvePlan(cached.planKey);
    return {
      isLoading: false,
      planKey: plan.key,
      planName: cached.planName,
      limits: cached.limits,
      capabilities: cached.capabilities ?? planCapabilities(plan.key, cached.limits),
      features: cached.features,
      access: cached.access,
      cloudMode: normalizeCloudMode(cached.cloudMode),
      fromCache: true,
      stale: cached.access.stale,
      subscription: cached.subscription,
      organizationId: cached.organizationId,
      pendingClosure: cached.pendingClosure ?? false,
      closureEffectiveAt: cached.closureEffectiveAt ?? null,
    };
  }

  const fallback = resolvePlan(undefined);
  return {
    isLoading: (online && remote === undefined) || (!online && !cacheReady),
    planKey: fallback.key,
    planName: fallback.name,
    limits: fallback.limits,
    capabilities: planCapabilities(fallback.key, fallback.limits),
    features: fallback.features,
    access: DEFAULT_ACCESS,
    cloudMode: DEFAULT_CLOUD_MODE,
    fromCache: false,
    stale: false,
    subscription: null,
    organizationId: null,
    pendingClosure: false,
    closureEffectiveAt: null,
  };
}
