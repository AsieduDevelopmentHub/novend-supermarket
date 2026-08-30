"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { BrowserDesktopTarget } from "@/lib/desktop";

/**
 * Live desktop + mobile install offers.
 * Convex `useQuery` is the subscription — when CI publishes a release the
 * mutation writes `desktopReleases` / `mobileReleases` and subscribed clients
 * update without polling.
 */
export function useReleaseOffers(
  preferredArch: BrowserDesktopTarget["arch"] | "x64",
  options?: { recentLimit?: number },
) {
  const desktop = useQuery(api.desktopReleases.getInstallOffer, {
    preferredArch,
    channel: "stable",
  });
  const mobile = useQuery(api.mobileReleases.getInstallOffer, {
    channel: "stable",
  });
  const recentLimit = options?.recentLimit;
  const desktopRecent = useQuery(
    api.desktopReleases.listPublicRecent,
    recentLimit ? { channel: "stable" as const, limit: recentLimit } : "skip",
  );
  const mobileRecent = useQuery(
    api.mobileReleases.listPublicRecent,
    recentLimit ? { channel: "stable" as const, limit: recentLimit } : "skip",
  );
  return { desktop, mobile, desktopRecent, mobileRecent };
}
