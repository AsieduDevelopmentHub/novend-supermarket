"use client";

import { use } from "react";
import { PlatformPaymentDetailView } from "@/features/platform/components/platform-payment-detail-view";

export default function PlatformPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PlatformPaymentDetailView paymentId={id} />;
}
