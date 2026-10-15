"use client";

import { useEffect, useState } from "react";
import { resolveProductImageSrc } from "@/lib/offline/image-cache";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";

/** Local blob first, cloud URL only when Dexie has no photo. */
export function useProductImageSrc(
  productId: string | undefined | null,
  remoteUrl?: string | null,
) {
  const fallback =
    remoteUrl && /^https?:\/\//i.test(remoteUrl)
      ? remoteUrl
      : null;
  const [src, setSrc] = useState<string | null>(fallback);

  useEffect(() => {
    if (!productId) {
      setSrc(fallback);
      return;
    }
    let cancelled = false;
    const load = () => {
      void resolveProductImageSrc(productId, remoteUrl, { thumbnail: true }).then((next) => {
        if (!cancelled) setSrc(next ?? fallback);
      });
    };
    queueMicrotask(load);
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [productId, remoteUrl, fallback]);

  if (!productId) return fallback;
  return src;
}
