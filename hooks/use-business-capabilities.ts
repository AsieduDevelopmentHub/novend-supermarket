"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  DEFAULT_BUSINESS_CONFIGURATION,
  hasBusinessCapability,
  type BusinessCapabilityKey,
  type OrganizationBusinessConfiguration,
} from "@/convex/shared/businessCapabilities";
import { loadBusinessCapabilitiesCache } from "@/lib/offline/business-capabilities";
import { useOfflineStatus } from "@/providers/offline-provider";

/**
 * Org business capabilities (industry packs / sell modes).
 * Online: Convex. Offline: Dexie meta cache from snapshot.
 */
export function useBusinessCapabilities() {
  const { online } = useOfflineStatus();
  const remote = useQuery(api.settings.getBusinessCapabilities, online ? {} : "skip");
  const [cached, setCached] = useState<OrganizationBusinessConfiguration>(
    DEFAULT_BUSINESS_CONFIGURATION,
  );

  useEffect(() => {
    if (online && remote) {
      queueMicrotask(() => setCached(remote));
      return;
    }
    let cancelled = false;
    void loadBusinessCapabilitiesCache().then((config) => {
      if (!cancelled) setCached(config);
    });
    return () => {
      cancelled = true;
    };
  }, [online, remote]);

  const config = remote ?? cached;

  const hasCapability = useCallback(
    (key: BusinessCapabilityKey) => hasBusinessCapability(config, key),
    [config],
  );

  return {
    config,
    hasCapability,
    industryProfile: config.industryProfile,
    enabledCapabilities: config.enabledCapabilities,
    configurationVersion: config.configurationVersion,
  };
}
