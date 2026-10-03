"use client";

import { useEffect, useState } from "react";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useOfflineStatus } from "@/providers/offline-provider";
import { shouldUseRemoteBusinessLists } from "@/lib/offline/freshness";

/**
 * Opens expensive live business queries only for a cold till. Once the Dexie
 * mirror has catalog data, the hourly snapshot is the single bulk read path.
 */
export function useBusinessDataGate() {
  const online = useConnectivity();
  const { lastSyncAt } = useOfflineStatus();
  // Prefer Dexie until the catalog probe finishes. Starting `serveLocal: false`
  // while online briefly opened every gated live query (including
  // dashboard.summary) before the mirror check resolved.
  const [state, setState] = useState({ ready: false, serveLocal: true });

  useEffect(() => {
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
