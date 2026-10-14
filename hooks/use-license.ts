"use client";

import { useEffect, useState } from "react";
import {
  FIRST_ACTIVATION_REQUIRED,
  loadOfflineLicenseState,
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
import { normalizeCloudMode, type CloudMode } from "@/convex/shared/cloudMode";
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
  features: Record<FeatureKey, boolean>;
  planFeatures: string[];
  experience: ResolvedExperienceTokens;
  billingVisibility: BillingVisibility;
  commercial: LicenseCommercialSnapshot;
  configVersion: number;
  access: LicenseAccess;
  cloudMode: CloudMode;
  plannedCloudMode: CloudMode;
  syncBoostUntil: number | null;
  fromCache: boolean;
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
 * Millie's: perpetual local licence from Dexie — never calls billing.licenseSnapshot.
 */
export function useLicense(): LicenseState {
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

  if (cached?.snapshot) {
    return {
      isLoading: false,
      ...stateFromCachedSnapshot(
        cached as OfflineLicenseState & { snapshot: LicenseSnapshot },
      ),
    };
  }

  const fallback = resolvePlan("lifetime");
  const defaults = defaultLicenseEntitlements(fallback.key);
  return {
    isLoading: !cacheReady,
    planKey: fallback.key,
    planName: fallback.name,
    limits: fallback.limits,
    capabilities: planCapabilities(fallback.key, fallback.limits),
    features: defaults.features,
    planFeatures: fallback.features,
    experience: defaults.experience,
    billingVisibility: "hidden",
    commercial: defaults.commercial,
    configVersion: defaults.configVersion,
    access: cached ? cached.access : DEFAULT_ACCESS,
    cloudMode: "local_only",
    plannedCloudMode: "local_only",
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
