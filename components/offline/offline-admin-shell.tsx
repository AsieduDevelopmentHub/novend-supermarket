"use client";

import { CloudOff } from "lucide-react";
import { PageHeader } from "@/components/layout/primitives";
import { EmptyState } from "@/components/feedback/empty-state";

/** Lightweight shell so admin routes still render offline without hanging on Convex. */
export function OfflineAdminShell({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={CloudOff}
        title="Available when you're back online"
        description="This area needs live server data. Sales, catalog, dashboard, and settings keep working from your local cache."
      />
    </div>
  );
}
