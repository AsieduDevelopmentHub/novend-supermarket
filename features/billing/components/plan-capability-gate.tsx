"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { useLicense } from "@/hooks/use-license";
import { capabilityDeniedMessage, type PlanCapabilities } from "@/convex/shared/capabilities";

type BooleanCapability = {
  [K in keyof PlanCapabilities]: PlanCapabilities[K] extends boolean ? K : never;
}[keyof PlanCapabilities];

export function PlanCapabilityGate({
  capability,
  title,
  description,
  children,
}: {
  capability: BooleanCapability;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const { capabilities, planName, isLoading } = useLicense();

  if (isLoading) {
    return <LoadingState label="Checking plan…" variant="form" />;
  }

  if (capabilities[capability]) {
    return <>{children}</>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4" aria-hidden />
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {capabilityDeniedMessage(capability, planName)}
        </p>
        <Button asChild>
          <Link href="/settings?section=billing">Upgrade plan</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
