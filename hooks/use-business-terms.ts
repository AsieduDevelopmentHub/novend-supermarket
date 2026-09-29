"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  DEFAULT_BUSINESS_TERMS,
  resolveBusinessTerms,
  type BusinessTerminologyOverrides,
  type BusinessTermsMap,
} from "@/convex/shared/businessTerms";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import { loadBusinessTermsCache } from "@/lib/offline/business-terms";
import { getBoundOrganizationId } from "@/lib/offline/db";
import { PLATFORM_OFFLINE_ORG_ID } from "@/lib/offline/platform-cache";
import { useOfflineStatus } from "@/providers/offline-provider";

/**
 * Resolved business terminology for the session org.
 * Online: industry from capabilities + optional `business.terminology` overrides.
 * Offline: Dexie meta cache from snapshot / last save.
 * Always reflects SAVED config — never settings-panel draft.
 */
export function useBusinessTerms() {
  const { online } = useOfflineStatus();
  const { industryProfile } = useBusinessCapabilities();
  const skipTenantQuery =
    typeof window !== "undefined" && getBoundOrganizationId() === PLATFORM_OFFLINE_ORG_ID;
  const remoteOverrides = useQuery(
    api.settings.getBusinessTerminology,
    online && !skipTenantQuery ? {} : "skip",
  );
  const [cached, setCached] = useState<{
    industryProfile: string;
    overrides: BusinessTerminologyOverrides;
    terms: BusinessTermsMap;
  }>({
    industryProfile: "retail",
    overrides: {},
    terms: DEFAULT_BUSINESS_TERMS,
  });

  useEffect(() => {
    if (online && remoteOverrides !== undefined) {
      const terms = resolveBusinessTerms(industryProfile, remoteOverrides);
      queueMicrotask(() =>
        setCached({
          industryProfile,
          overrides: remoteOverrides,
          terms,
        }),
      );
      return;
    }
    let cancelled = false;
    void loadBusinessTermsCache().then((row) => {
      if (!cancelled) setCached(row);
    });
    return () => {
      cancelled = true;
    };
  }, [online, remoteOverrides, industryProfile]);

  const overrides = remoteOverrides ?? cached.overrides;
  const profile = online && remoteOverrides !== undefined ? industryProfile : cached.industryProfile;
  const terms =
    online && remoteOverrides !== undefined
      ? resolveBusinessTerms(industryProfile, remoteOverrides)
      : cached.terms;

  function t(key: keyof BusinessTermsMap): string {
    return terms[key] ?? DEFAULT_BUSINESS_TERMS[key];
  }

  return {
    terms,
    overrides,
    industryProfile: profile,
    t,
  };
}
