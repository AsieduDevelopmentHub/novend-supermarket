"use client";

import Link from "next/link";
import { usePermissions } from "@/hooks/use-permissions";
import { moreSectionsForRole } from "@/config/mobile-navigation";
import { PageHeader } from "@/components/layout/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { ChevronRight, CreditCard, HelpCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const EXTRA_SYSTEM = [
  { title: "About Novend", href: "/about", icon: Info },
  { title: "Billing", href: "/settings?section=billing", icon: CreditCard },
  { title: "Help", href: "/docs/help", icon: HelpCircle },
] as const;

/**
 * Capacitor More menu — grouped cards for destinations outside the bottom tabs.
 */
export function MoreView() {
  const { role, isLoading } = usePermissions();

  if (isLoading || !role) {
    return <LoadingState label="Loading…" />;
  }

  const sections = moreSectionsForRole(role);

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-4">
      <PageHeader
        title="More"
        description="Everything else for your role, grouped for quick access."
      />

      {sections.map((section) => (
        <Card key={section.id} className="overflow-hidden rounded-[20px]">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {section.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 px-2 pb-3">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-[16px] px-3 py-2.5 transition-colors",
                    "hover:bg-muted/80 active:bg-muted",
                  )}
                >
                  <span className="bg-accent text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
                  <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                </Link>
              );
            })}
            {section.id === "system"
              ? EXTRA_SYSTEM.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex min-h-12 items-center gap-3 rounded-[16px] px-3 py-2.5 transition-colors",
                        "hover:bg-muted/80 active:bg-muted",
                      )}
                    >
                      <span className="bg-accent text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {item.title}
                      </span>
                      <ChevronRight
                        className="text-muted-foreground h-4 w-4 shrink-0"
                        aria-hidden
                      />
                    </Link>
                  );
                })
              : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
