"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePermissions } from "@/hooks/use-permissions";
import {
  DEFAULT_SALES_PRODUCT_DISPLAY,
  parseSalesProductDisplay,
  salesProductDisplayStorageKey,
  serializeSalesProductDisplay,
  type SalesProductDisplay,
} from "@/lib/sales/product-display";

function readLocal(userId: string | null | undefined): SalesProductDisplay {
  if (!userId || typeof window === "undefined") return { ...DEFAULT_SALES_PRODUCT_DISPLAY };
  try {
    return parseSalesProductDisplay(
      window.localStorage.getItem(salesProductDisplayStorageKey(userId)),
    );
  } catch {
    return { ...DEFAULT_SALES_PRODUCT_DISPLAY };
  }
}

function writeLocal(userId: string, prefs: SalesProductDisplay) {
  if (typeof window === "undefined") return;
  const key = salesProductDisplayStorageKey(userId);
  const next = serializeSalesProductDisplay(prefs);
  try {
    if (window.localStorage.getItem(key) === next) return;
  } catch {
    /* private mode */
  }
  window.localStorage.setItem(key, next);
}

function sameDisplay(a: SalesProductDisplay, b: SalesProductDisplay): boolean {
  return serializeSalesProductDisplay(a) === serializeSalesProductDisplay(b);
}

/**
 * Sales catalog layout preference: localStorage first (offline), synced from
 * profile when online.
 *
 * Avoids useSyncExternalStore — a getSnapshot that allocates a new object each
 * call causes React error #185 (maximum update depth) and blanked Sales.
 */
export function useSalesProductDisplay() {
  const { userId } = usePermissions();
  const { isAuthenticated } = useConvexAuth();
  const online = useConnectivity();
  const me = useQuery(api.users.me, isAuthenticated && online ? {} : "skip");
  const updateOwn = useMutation(api.users.updateOwnSalesProductDisplay);
  const syncedForUser = useRef<string | null>(null);
  const [prefs, setPrefs] = useState<SalesProductDisplay>(DEFAULT_SALES_PRODUCT_DISPLAY);
  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (lastUserId.current === userId) return;
    lastUserId.current = userId;
    syncedForUser.current = null;
    const next = readLocal(userId);
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setPrefs((current) => (sameDisplay(current, next) ? current : next));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!isAuthenticated || !online) return;
    if (!me || me.needsProfile || !me.userId) return;
    if (syncedForUser.current === me.userId) return;
    syncedForUser.current = me.userId;

    const local = readLocal(me.userId);
    const remoteRaw = me.salesProductDisplay ?? null;
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (remoteRaw) {
        const remote = parseSalesProductDisplay(remoteRaw);
        writeLocal(me.userId, remote);
        setPrefs((current) => (sameDisplay(current, remote) ? current : remote));
        return;
      }
      writeLocal(me.userId, local);
      setPrefs((current) => (sameDisplay(current, local) ? current : local));
      void updateOwn({ salesProductDisplay: serializeSalesProductDisplay(local) }).catch(() => {
        /* offline / transient — local still wins */
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, me, online, updateOwn]);

  const setDisplay = useCallback(
    (next: SalesProductDisplay) => {
      const normalized = parseSalesProductDisplay(serializeSalesProductDisplay(next));
      setPrefs(normalized);
      if (userId) writeLocal(userId, normalized);
      if (isAuthenticated && online && userId) {
        void updateOwn({
          salesProductDisplay: serializeSalesProductDisplay(normalized),
        }).catch(() => {
          /* local preference already applied */
        });
      }
    },
    [isAuthenticated, online, updateOwn, userId],
  );

  return { display: prefs, setDisplay };
}
