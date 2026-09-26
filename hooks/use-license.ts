"use client";

import { useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  FIRST_ACTIVATION_REQUIRED,
  loadOfflineLicenseState,
  resolveOfflineLicenseState,
  saveLicenseSnapshot,
  type OfflineLicenseState,
} from "@/lib/offline/license";
import {
  defaultLicenseEntitlements,
  type LicenseAccess,
  type LicenseCommercialSnapshot,
  type LicenseSnapshot,
} from "@/convex/shared/licensing";
import { resolvePlan, type PlanKey, type PlanLimits } from "@/convex/shared/plans";
import { planCapabilities, type PlanCapabilities } from "@/convex/shared/capabilities";
import { DEFAULT_CLOUD_MODE, normalizeCloudMode, type CloudMode } from "@/convex/shared/cloudMode";
import {
  DEFAULT_NOVEND_EXPERIENCE,
  type ResolvedExperienceTokens,
} from "@/convex/shared/experience";
import type { FeatureKey } from "@/convex/shared/features";
import type { BillingVisibility } from "@/convex/shared/organizationConfig";

export type LicenseState = {
  isLoading: boolean;
  planKey: PlanKey;
  planName: string;
  limits: PlanLimits;
  capabilities: PlanCapabilities;
  /** Resolved feature entitlements. */
  features: Record<FeatureKey, boolean>;
  /** Plan marketing bullets. */
  planFeatures: string[];
  experience: ResolvedExperienceTokens;
  billingVisibility: BillingVisibility;
  commercial: LicenseCommercialSnapshot;
  configVersion: number;
  access: LicenseAccess;
  /** Cloud usage mode for this organization. Defaults to full_sync. */
  cloudMode: CloudMode;
  /** PEAS-planned mode (ignores temporary org sync boost). */
  plannedCloudMode: CloudMode;
  /** Org-wide catch-up boost end time, or null. */
  syncBoostUntil: number | null;
  /** True when the licence came from the offline cache rather than Convex. */
  fromCache: boolean;
  /** Cached licence that is too old to be trusted for writes. */
  stale: boolean;
  offlineState: OfflineLicenseState["kind"] | null;
  subscription: LicenseSnapshot["subscription"];
  organizationId: string | null;
  pendingClosure: boolean;
  closureEffectiveAt: number | null;
};

const DEFAULT_ACCESS: LicenseAccess = {
  state: "expired",
  canRead: true,
  canWrite: false,
  reason: FIRST_ACTIVATION_REQUIRED,
  expiresAt: null,
};

function entitlementsFromSnapshot(snapshot: LicenseSnapshot | null, planKey: PlanKey) {
  const defaults = defaultLicenseEntitlements(planKey);
  if (!snapshot) {
    return {
      features: defaults.features,
      planFeatures: resolvePlan(planKey).features,
      experience: defaults.experience,
      billingVisibility: defaults.billingVisibility,
      commercial: defaults.commercial,
      configVersion: defaults.configVersion,
    };
  }
  // Merge so newly added FeatureKeys (e.g. products.editStock) are present even
  // when a cached/live snapshot was issued before that key existed.
  const features = { ...defaults.features, ...(snapshot.features ?? {}) };
  return {
    features,
    planFeatures: snapshot.planFeatures ?? resolvePlan(planKey).features,
    experience: snapshot.experience ?? DEFAULT_NOVEND_EXPERIENCE,
    billingVisibility: snapshot.billingVisibility ?? defaults.billingVisibility,
    commercial: snapshot.commercial ?? defaults.commercial,
    configVersion: snapshot.configVersion ?? snapshot.entitlementVersion ?? 0,
  };
}

function stateFromCachedSnapshot(cached: OfflineLicenseState & { snapshot: LicenseSnapshot }): Omit<
  LicenseState,
  "isLoading"
> {
  const plan = resolvePlan(cached.snapshot.planKey);
  const entitlements = entitlementsFromSnapshot(cached.snapshot, plan.key);
  return {
    planKey: plan.key,
    planName: cached.snapshot.planName,
    limits: cached.snapshot.limits,
    capabilities:
      cached.snapshot.capabilities ?? planCapabilities(plan.key, cached.snapshot.limits),
    ...entitlements,
    access: cached.access,
    cloudMode: normalizeCloudMode(cached.snapshot.cloudMode),
    plannedCloudMode: normalizeCloudMode(
      cached.snapshot.plannedCloudMode ?? cached.snapshot.cloudMode,
    ),
    syncBoostUntil:
      typeof cached.snapshot.syncBoostUntil === "number" ? cached.snapshot.syncBoostUntil : null,
    fromCache: true,
    stale: cached.access.stale,
    offlineState: cached.kind,
    subscription: cached.snapshot.subscription,
    organizationId: cached.snapshot.organizationId,
    pendingClosure: cached.snapshot.pendingClosure ?? false,
    closureEffectiveAt: cached.snapshot.closureEffectiveAt ?? null,
  };
}

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
  const [cached, setCached] = useState<OfflineLicenseState | null>(null);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadOfflineLicenseState().then((state) => {
      if (cancelled) return;
      setCached(state);
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!remote) return;
    const snapshot = remote as LicenseSnapshot;
    void saveLicenseSnapshot(snapshot);
    // Keep React cache in sync so experience tokens survive Cap/Electron
    // "online" false positives and mid-session disconnects without a remount.
    setCached(
      resolveOfflineLicenseState({
        raw: JSON.stringify(snapshot),
        activatedBefore: true,
        establishedOrganizationId: snapshot.organizationId,
      }),
    );
    setCacheReady(true);
  }, [remote]);

  if (remote) {
    const plan = resolvePlan(remote.planKey);
    const entitlements = entitlementsFromSnapshot(remote as LicenseSnapshot, plan.key);
    return {
      isLoading: false,
      planKey: plan.key,
      planName: remote.planName,
      limits: remote.limits,
      capabilities: remote.capabilities ?? planCapabilities(plan.key, remote.limits),
      ...entitlements,
      access: remote.access,
      cloudMode: normalizeCloudMode(remote.cloudMode),
      plannedCloudMode: normalizeCloudMode(remote.plannedCloudMode ?? remote.cloudMode),
      syncBoostUntil:
        typeof remote.syncBoostUntil === "number" ? remote.syncBoostUntil : null,
      fromCache: false,
      stale: false,
      offlineState: null,
      subscription: remote.subscription,
      organizationId: remote.organizationId,
      pendingClosure: remote.pendingClosure ?? false,
      closureEffectiveAt: remote.closureEffectiveAt ?? null,
    };
  }

  // Prefer the Dexie/localStorage snapshot whenever live remote is missing.
  // Do not gate on !online — Cap/Electron often keep navigator.onLine true
  // while Convex never resolves, which used to leave DEFAULT_NOVEND_EXPERIENCE
  // painted (org colors "missing" offline).
  if (cached?.snapshot) {
    return {
      isLoading: false,
      ...stateFromCachedSnapshot(
        cached as OfflineLicenseState & { snapshot: LicenseSnapshot },
      ),
    };
  }

  const fallback = resolvePlan(undefined);
  const defaults = defaultLicenseEntitlements(fallback.key);
  return {
    isLoading: !cacheReady || (online && isAuthenticated && remote === undefined),
    planKey: fallback.key,
    planName: fallback.name,
    limits: fallback.limits,
    capabilities: planCapabilities(fallback.key, fallback.limits),
    features: defaults.features,
    planFeatures: fallback.features,
    experience: defaults.experience,
    billingVisibility: defaults.billingVisibility,
    commercial: defaults.commercial,
    configVersion: defaults.configVersion,
    access: cached ? cached.access : DEFAULT_ACCESS,
    cloudMode: DEFAULT_CLOUD_MODE,
    plannedCloudMode: DEFAULT_CLOUD_MODE,
    syncBoostUntil: null,
    fromCache: false,
    stale: false,
    offlineState: cached ? cached.kind : null,
    subscription: null,
    organizationId: null,
    pendingClosure: false,
    closureEffectiveAt: null,
  };
}
