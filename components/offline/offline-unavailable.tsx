"use client";

import Link from "next/link";
import { CloudOff } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

/** Shown for detail / write-heavy routes that cannot run fully offline yet. */
export function OfflineUnavailable({
  title,
  description,
  backHref = "/dashboard",
  backLabel = "Back to dashboard",
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <EmptyState
      icon={CloudOff}
      title={title}
      description={
        description ??
        "This screen needs a connection. You can keep selling from the till."
      }
      action={
        <Button asChild variant="outline">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      }
    />
  );
}
