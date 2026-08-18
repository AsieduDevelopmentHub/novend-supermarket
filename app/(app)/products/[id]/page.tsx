"use client";

import { use } from "react";
import { ProductDetailView } from "@/features/products/components/product-detail-view";
import { Id } from "@/convex/_generated/dataModel";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProductDetailView productId={id as Id<"products">} />;
}
