"use client";

import { use } from "react";
import { SupplierDetailView } from "@/features/suppliers/components/supplier-detail-view";

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SupplierDetailView supplierId={id} />;
}
