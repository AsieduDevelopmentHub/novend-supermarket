"use client";

import { useCallback } from "react";
import { useOfflineNavigation } from "@/providers/offline-navigation";
import { useConnectivity } from "@/hooks/use-connectivity";

/**
 * App navigation that stays instant online and usable offline.
 * Prefer this over raw `router.push` inside authenticated screens.
 */
export function useAppNavigation() {
  const online = useConnectivity();
  const { navigate } = useOfflineNavigation();

  const go = useCallback(
    (href: string) => {
      navigate(href);
    },
    [navigate],
  );

  return { navigate: go, online };
}
