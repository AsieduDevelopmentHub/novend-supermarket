"use client";

import type { ReactNode } from "react";
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
 */
export function ProductImage({ productId, remoteUrl, alt, className, sizes, fallback }: Props) {
  const src = useProductImageSrc(productId, remoteUrl);
  if (!src) return <>{fallback ?? null}</>;

  if (src.startsWith("blob:")) {
    return (
      // Blob URLs are device-local; next/image cannot optimize them.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={cn("absolute inset-0 h-full w-full object-cover", className)} />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={cn("object-cover", className)}
      sizes={sizes ?? "96px"}
      unoptimized
    />
  );
}
