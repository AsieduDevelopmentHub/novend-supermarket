"use client";

import { useEffect, useState } from "react";
import { useConvexAuth } from "convex/react";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useOfflineStatus } from "@/providers/offline-provider";
import { shouldUseRemoteBusinessLists } from "@/lib/offline/freshness";

/**
 * Opens expensive live business queries only for a cold till. Once the Dexie
 * mirror has catalog data, the hourly snapshot is the single bulk read path.
 * An offline shell without a Convex JWT always serves Dexie, even with radio.
 */
export function useBusinessDataGate() {
  const online = useConnectivity();
  const { isAuthenticated } = useConvexAuth();
  const { lastSyncAt } = useOfflineStatus();
  const liveSession = online && isAuthenticated;
  // Prefer Dexie until the catalog probe finishes. Starting `serveLocal: false`
  // while online briefly opened every gated live query (including
  // dashboard.summary) before the mirror check resolved.
  const [state, setState] = useState({ ready: false, serveLocal: true });

  useEffect(() => {
    let cancelled = false;
    void shouldUseRemoteBusinessLists(liveSession).then((useRemote) => {
      if (cancelled) return;
      setState({ ready: true, serveLocal: !useRemote });
    });
    return () => {
      cancelled = true;
    };
  }, [liveSession, lastSyncAt]);

  return { online, lastSyncAt, ...state };
}
