"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  DEFAULT_PRODUCT_IMAGES_POLICY,
  type ProductImagesPolicy,
} from "@/convex/shared/productImagesPolicy";
import {
  loadProductImagesPolicyCache,
  saveProductImagesPolicyCache,
} from "@/lib/offline/product-images-policy";
import { getBoundOrganizationId } from "@/lib/offline/db";
import { PLATFORM_OFFLINE_ORG_ID } from "@/lib/offline/platform-cache";
import { useOfflineStatus } from "@/providers/offline-provider";

/**
 * Org product-image upload policy.
 * Online: Convex. Offline: Dexie meta from snapshot.
 */
export function useProductImagesPolicy(): ProductImagesPolicy {
  const { online } = useOfflineStatus();
  const skipTenantQuery =
    typeof window !== "undefined" && getBoundOrganizationId() === PLATFORM_OFFLINE_ORG_ID;
  const remote = useQuery(api.settings.getProductImages, online && !skipTenantQuery ? {} : "skip");
  const [cached, setCached] = useState<ProductImagesPolicy>(DEFAULT_PRODUCT_IMAGES_POLICY);

  useEffect(() => {
    if (online && remote) {
      void saveProductImagesPolicyCache(remote);
      queueMicrotask(() => setCached(remote));
      return;
    }
    let cancelled = false;
    void loadProductImagesPolicyCache().then((policy) => {
      if (!cancelled) setCached(policy);
    });
    return () => {
      cancelled = true;
    };
  }, [online, remote]);

  return remote ?? cached;
}
