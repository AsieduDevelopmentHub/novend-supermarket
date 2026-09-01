"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  loadPosPreferences,
  peekPosPreferences,
  savePosPreferences,
  type CachedPosPreferences,
} from "@/lib/offline/pos-preferences";

/** Receipt print mode — live when online, last cached value when not. */
export function usePosPreferences(): CachedPosPreferences {
  const online = useConnectivity();
  const live = useQuery(api.settings.getPosPreferences, online ? {} : "skip");
  const [cached, setCached] = useState<CachedPosPreferences>(peekPosPreferences);

  useEffect(() => {
    let cancelled = false;
    void loadPosPreferences().then((prefs) => {
      if (!cancelled) setCached(prefs);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!live) return;
    void savePosPreferences(live);
  }, [live]);

  return live ?? cached;
}
