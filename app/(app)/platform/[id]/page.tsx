"use client";

import { use, useEffect } from "react";
import { PlatformOrgDetailView } from "@/features/platform/components/platform-org-detail-view";
import { PLATFORM_STATIC_SEGMENTS } from "@/config/platform-navigation";
import { LoadingState } from "@/components/feedback/loading-state";

/**
 * Org detail lives at `/platform/[id]`. Static siblings (`/platform/plans`, …)
 * normally win, but soft navigation can briefly land here with a reserved
 * segment — force a full navigation so the static page renders.
 */
export default function PlatformOrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isReserved = PLATFORM_STATIC_SEGMENTS.has(id);

  useEffect(() => {
    if (!isReserved) return;
    window.location.replace(`/platform/${id}`);
  }, [id, isReserved]);

  if (isReserved) {
    return <LoadingState label="Loading…" />;
  }

  return <PlatformOrgDetailView organizationId={id} />;
}
