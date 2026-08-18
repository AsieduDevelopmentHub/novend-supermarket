"use client";

import { use } from "react";
import { BranchDetailView } from "@/features/branches/components/branch-detail-view";

export default function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BranchDetailView branchId={id} />;
}
