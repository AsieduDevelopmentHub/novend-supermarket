"use client";

import { useEffect, useState } from "react";
import { FULLY_OFFLINE } from "@/constants/runtime";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useOfflineStatus } from "@/providers/offline-provider";
import { shouldUseRemoteBusinessLists } from "@/lib/offline/freshness";

/**
 * Opens expensive live business queries only for a cold till. Millie's always
 * serves Dexie — never opens Convex list subscriptions.
 */
export function useBusinessDataGate() {
  const online = useConnectivity();
  const { lastSyncAt } = useOfflineStatus();
  const [state, setState] = useState({ ready: false, serveLocal: true });

  useEffect(() => {
    if (FULLY_OFFLINE) {
      queueMicrotask(() => setState({ ready: true, serveLocal: true }));
      return;
    }
    let cancelled = false;
    void shouldUseRemoteBusinessLists(online).then((useRemote) => {
      if (cancelled) return;
      setState({ ready: true, serveLocal: !useRemote });
    });
    return () => {
      cancelled = true;
    };
  }, [online, lastSyncAt]);

  return { online, lastSyncAt, ...state };
}
