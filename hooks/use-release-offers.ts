"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { BrowserDesktopTarget } from "@/lib/desktop";
import { useConnectivity } from "@/hooks/use-connectivity";

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
  const online = useConnectivity();
  const desktop = useQuery(
    api.desktopReleases.getInstallOffer,
    online ? { preferredArch, channel: "stable" as const } : "skip",
  );
  const mobile = useQuery(
    api.mobileReleases.getInstallOffer,
    online ? { channel: "stable" as const } : "skip",
  );
  const recentLimit = options?.recentLimit;
  const desktopRecent = useQuery(
    api.desktopReleases.listPublicRecent,
    online && recentLimit ? { channel: "stable" as const, limit: recentLimit } : "skip",
  );
  const mobileRecent = useQuery(
    api.mobileReleases.listPublicRecent,
    online && recentLimit ? { channel: "stable" as const, limit: recentLimit } : "skip",
  );
  return { desktop, mobile, desktopRecent, mobileRecent, online };
}
