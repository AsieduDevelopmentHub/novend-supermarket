"use client";

import { use } from "react";
import { ReturnDetailView } from "@/features/returns/components/return-detail-view";

export default function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ReturnDetailView returnId={id} />;
}
