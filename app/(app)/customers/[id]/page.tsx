"use client";

import { use } from "react";
import { CustomerDetailView } from "@/features/customers/components/customer-detail-view";
import { Id } from "@/convex/_generated/dataModel";

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CustomerDetailView customerId={id as Id<"customers">} />;
}
