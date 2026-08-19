"use client";

import { use } from "react";
import { PlatformOrgDetailView } from "@/features/platform/components/platform-org-detail-view";

export default function PlatformOrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PlatformOrgDetailView organizationId={id} />;
}
