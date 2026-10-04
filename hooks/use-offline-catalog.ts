"use client";

import { useCallback, useEffect, useState } from "react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { listLocalCatalogProducts, searchLocalCustomers } from "@/lib/offline/snapshot";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import { shouldUseRemoteSalesCatalog } from "@/lib/offline/freshness";
import { useOfflineStatus } from "@/providers/offline-provider";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useAuthedQuery } from "@/hooks/use-authed-query";

export type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  sellingPrice: number;
  stockQuantity: number;
  unit: string;
  sellUnits?: Array<{
    key: string;
    label: string;
    factorToBase: number;
    barcode?: string;
    sellingPrice?: number;
    active: boolean;
  }> | null;
  pricingMode?: "fixed" | "per_weight" | null;
  imageUrl: string | null;
  isExpiring?: boolean;
  /** False when non-stock catalogue item (menu / room rate). Missing = track stock. */
  tracksInventory?: boolean;
};

/** Sellable base qty for POS checks — unlimited when inventory is not tracked. */
export function catalogAvailableQuantity(
  product: Pick<CatalogProduct, "stockQuantity" | "tracksInventory"> | undefined,
): number {
  if (!product) return 0;
  if (product.tracksInventory === false) return Number.POSITIVE_INFINITY;
  return product.stockQuantity;
}

export type CatalogStockHint = Pick<CatalogProduct, "stockQuantity" | "tracksInventory">;

/** Prefer live catalog row, then session hint (cart products often leave the search window). */
export function resolveCatalogAvailable(
  productId: string,
  catalog: Array<Pick<CatalogProduct, "id" | "stockQuantity" | "tracksInventory">>,
  hints?: Record<string, CatalogStockHint>,
): number {
  const live = catalog.find((row) => row.id === productId);
  if (live) return catalogAvailableQuantity(live);
  const hint = hints?.[productId];
  if (hint) return catalogAvailableQuantity(hint);
  return 0;
}

function mapRemoteProducts(
  remote: Array<{
    id: string;
    name: string;
    sku: string;
    barcode?: string | null;
    sellingPrice: number;
    stockQuantity: number;
    unit: string;
    sellUnits?: CatalogProduct["sellUnits"];
    pricingMode?: CatalogProduct["pricingMode"];
    imageUrl: string | null;
    isExpiring?: boolean;
    tracksInventory?: boolean;
  }>,
): CatalogProduct[] {
  return remote.map((p) => ({
    id: p.id as string,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    sellingPrice: p.sellingPrice,
    stockQuantity: p.stockQuantity,
    unit: p.unit,
    sellUnits: p.sellUnits ?? null,
    pricingMode: p.pricingMode ?? null,
    imageUrl: p.imageUrl,
    isExpiring: p.isExpiring,
    tracksInventory: p.tracksInventory,
  }));
}

/**
 * Branch-scoped product catalog for Sales.
 * Warm Dexie mirror skips the live Convex subscription. Package cloud modes
 * always stay local so checkout never sells remote-only product ids.
 */
export function useSalesCatalog(search: string, branchId?: Id<"branches"> | null) {
  const online = useConnectivity();
  const { isAuthenticated } = useConvexAuth();
  const liveSession = online && isAuthenticated;
  const { lastSyncAt } = useOfflineStatus();
  const branchKey = branchId ?? undefined;
  const [serveLocal, setServeLocal] = useState(false);
  const [gateReady, setGateReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const useRemote = await shouldUseRemoteSalesCatalog(liveSession);
      if (cancelled) return;
      setServeLocal(!useRemote);
      setGateReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [liveSession, lastSyncAt]);

  const remote = useAuthedQuery(
    api.sales.catalog,
    online && gateReady && !serveLocal
      ? { search: search || undefined, branchId: branchKey }
      : "skip",
  );
  const [local, setLocal] = useState<CatalogProduct[] | null>(null);

  const refreshLocal = useCallback(async () => {
    const rows = await listLocalCatalogProducts(search || undefined, branchKey ?? null);
    setLocal(rows);
  }, [search, branchKey]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listLocalCatalogProducts(search || undefined, branchKey ?? null).then((rows) => {
        if (!cancelled) setLocal(rows ?? []);
      });
    };
    const timer = window.setTimeout(load, 0);
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsub();
    };
  }, [search, branchKey, lastSyncAt]);

  if (!online || serveLocal) {
    if (local != null) {
      return {
        products: local,
        source: "local" as const,
        loading: false,
        refreshLocal,
      };
    }
    return {
      products: [] as CatalogProduct[],
      source: "local" as const,
      loading: !gateReady || local == null,
      refreshLocal,
    };
  }

  if (remote !== undefined) {
    return {
      products: mapRemoteProducts(remote),
      source: "remote" as const,
      loading: false,
      refreshLocal,
    };
  }

  if (local != null) {
    return {
      products: local,
      source: "local" as const,
      loading: false,
      refreshLocal,
    };
  }

  return {
    products: [] as CatalogProduct[],
    source: "remote" as const,
    loading: true,
    refreshLocal,
  };
}

export function useSalesCustomerSearch(query: string) {
  const { online, lastSyncAt } = useOfflineStatus();
  const { isAuthenticated } = useConvexAuth();
  const liveSession = online && isAuthenticated;
  const trimmed = query.trim();
  const [serveLocal, setServeLocal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const useRemote = await shouldUseRemoteSalesCatalog(liveSession);
      if (!cancelled) setServeLocal(!useRemote);
    })();
    return () => {
      cancelled = true;
    };
  }, [liveSession, lastSyncAt]);

  const remote = useAuthedQuery(
    api.customers.search,
    online && !serveLocal && trimmed.length >= 2 ? { q: query, limit: 6 } : "skip",
  );
  const [localHits, setLocalHits] = useState<
    Array<{ id: string; name: string; phone: string | null }>
  >([]);

  useEffect(() => {
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchLocalCustomers(query, 6).then((hits) => {
        if (!cancelled) setLocalHits(hits ?? []);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, trimmed.length, lastSyncAt]);

  const effectiveLocal = trimmed.length < 2 ? [] : localHits;

  if (!online || serveLocal) {
    return effectiveLocal;
  }
  if (remote !== undefined) {
    return remote.map((c) => ({
      id: c.id as string,
      name: c.name,
      phone: c.phone,
    }));
  }
  return effectiveLocal;
}
