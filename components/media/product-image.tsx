"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useProductImageSrc } from "@/hooks/use-product-image";

type Props = {
  productId: string;
  remoteUrl?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  fallback?: ReactNode;
};

/**
 * Product photo that prefers the IndexedDB blob so POS cards work offline.
 * Defers Dexie reads until the tile is near the viewport — critical on 4GB tills
 * when the Sales grid mounts many cards at once.
 */
export function ProductImage({ productId, remoteUrl, alt, className, sizes, fallback }: Props) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px 0px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const src = useProductImageSrc(nearViewport ? productId : null, remoteUrl);

  return (
    <span ref={hostRef} className="absolute inset-0 block">
      {!src ? (
        <>{fallback ?? null}</>
      ) : src.startsWith("blob:") ? (
        // Blob URLs are device-local; next/image cannot optimize them.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={cn("absolute inset-0 h-full w-full object-cover", className)}
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          className={cn("object-cover", className)}
          sizes={sizes ?? "96px"}
          unoptimized
        />
      )}
    </span>
  );
}
