"use client";

import { useEffect, useState } from "react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import {
  DEFAULT_EXPIRY_POLICY,
  type ExpiryPolicy,
} from "@/convex/shared/expiryPolicy";
import { loadExpiryPolicyCache, saveExpiryPolicyCache } from "@/lib/offline/expiry-policy";
import { getBoundOrganizationId } from "@/lib/offline/db";
import { PLATFORM_OFFLINE_ORG_ID } from "@/lib/offline/platform-cache";
import { useOfflineStatus } from "@/providers/offline-provider";

/**
 * Org default expiry alert days.
 * Online: Convex. Offline: Dexie meta from snapshot.
 */
export function useExpiryPolicy(): ExpiryPolicy {
  const { online } = useOfflineStatus();
  const skipTenantQuery =
    typeof window !== "undefined" && getBoundOrganizationId() === PLATFORM_OFFLINE_ORG_ID;
  const remote = useAuthedQuery(
    api.settings.getExpiryPolicy,
    online && !skipTenantQuery ? {} : "skip",
  );
  const [cached, setCached] = useState<ExpiryPolicy>(DEFAULT_EXPIRY_POLICY);

  useEffect(() => {
    if (online && remote) {
      void saveExpiryPolicyCache(remote);
      queueMicrotask(() => setCached(remote));
      return;
    }
    let cancelled = false;
    void loadExpiryPolicyCache().then((policy) => {
      if (!cancelled) setCached(policy);
    });
    return () => {
      cancelled = true;
    };
  }, [online, remote]);

  return remote ?? cached;
}
