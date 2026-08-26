"use client";

import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AccessDeniedProps = {
  title?: string;
  message?: string;
  className?: string;
};

/**
 * In-shell access denied (offline Cap navigation / section gates).
 * Keeps cashiers inside Novend instead of a system error page.
 */
export function AccessDenied({
  title = "You don’t have access",
  message = "This section isn’t available for your role. Continue from Dashboard or Sales.",
  className,
}: AccessDeniedProps) {
  return (
    <div
      className={cn(
        "bg-card border-border flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-12 text-center",
        className,
      )}
    >
      <ShieldOff className="text-muted-foreground h-8 w-8" aria-hidden />
      <div>
        <h3 className="text-foreground font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">{message}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild type="button" size="sm">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <Button asChild type="button" size="sm" variant="outline">
          <Link href="/sales">Sales</Link>
        </Button>
      </div>
    </div>
  );
}
