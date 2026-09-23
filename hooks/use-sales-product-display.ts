"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
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

const listeners = new Set<() => void>();

function notifySalesDisplayListeners() {
  listeners.forEach((listener) => listener());
}

function subscribeSalesDisplay(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

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
  window.localStorage.setItem(
    salesProductDisplayStorageKey(userId),
    serializeSalesProductDisplay(prefs),
  );
  notifySalesDisplayListeners();
}

/**
 * Sales catalog layout preference: localStorage first (offline), synced from
 * profile when online — same pattern as appearance preferences.
 */
export function useSalesProductDisplay() {
  const { userId } = usePermissions();
  const { isAuthenticated } = useConvexAuth();
  const online = useConnectivity();
  const me = useQuery(api.users.me, isAuthenticated && online ? {} : "skip");
  const updateOwn = useMutation(api.users.updateOwnSalesProductDisplay);
  const syncedForUser = useRef<string | null>(null);

  const prefs = useSyncExternalStore(
    subscribeSalesDisplay,
    () => readLocal(userId),
    () => ({ ...DEFAULT_SALES_PRODUCT_DISPLAY }),
  );

  useEffect(() => {
    if (!me || me.needsProfile || !me.userId) return;
    if (syncedForUser.current === me.userId) return;
    syncedForUser.current = me.userId;

    const local = readLocal(me.userId);
    const remoteRaw = me.salesProductDisplay ?? null;

    // Defer store writes so we do not call setState synchronously inside an effect.
    void Promise.resolve().then(() => {
      if (remoteRaw) {
        writeLocal(me.userId, parseSalesProductDisplay(remoteRaw));
        return;
      }
      writeLocal(me.userId, local);
      if (online) {
        void updateOwn({ salesProductDisplay: serializeSalesProductDisplay(local) }).catch(() => {
          /* offline / transient — local still wins */
        });
      }
    });
  }, [me, online, updateOwn]);

  const setDisplay = useCallback(
    (next: SalesProductDisplay) => {
      const normalized = parseSalesProductDisplay(serializeSalesProductDisplay(next));
      if (userId) writeLocal(userId, normalized);
      if (online && userId) {
        void updateOwn({
          salesProductDisplay: serializeSalesProductDisplay(normalized),
        }).catch(() => {
          /* local preference already applied */
        });
      }
    },
    [online, updateOwn, userId],
  );

  return { display: prefs, setDisplay };
}
