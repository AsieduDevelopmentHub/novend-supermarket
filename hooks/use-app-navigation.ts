"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useOfflineNavigation } from "@/providers/offline-navigation";

/**
 * App navigation that stays usable offline.
 * Prefer this over raw `router.push` inside authenticated screens.
 */
export function useAppNavigation() {
  const online = useConnectivity();
  const router = useRouter();
  const offlineNav = useOfflineNavigation();

  const navigate = useCallback(
    (href: string) => {
      if (!online || offlineNav.clientRouting) {
        offlineNav.navigate(href);
        return;
      }
      router.push(href);
    },
    [online, offlineNav, router],
  );

  return { navigate, online };
}
