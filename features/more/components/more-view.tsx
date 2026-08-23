"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { usePermissions } from "@/hooks/use-permissions";
import { moreSectionsForRole } from "@/config/mobile-navigation";
import { PageHeader } from "@/components/layout/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/feedback/loading-state";
import { signOutAndRedirect } from "@/lib/auth/sign-out";
import { ChevronRight, CreditCard, HelpCircle, Info, LogOut } from "lucide-react";
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
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { role, isLoading } = usePermissions();
  const [signingOut, setSigningOut] = useState(false);

  if (isLoading || !role) {
    return <LoadingState label="Loading…" />;
  }

  const sections = moreSectionsForRole(role);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutAndRedirect({ signOut, router });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-4">
      <PageHeader
        title="More"
        description="Everything else for your role, grouped for quick access."
        compactActions={[
          {
            key: "logout",
            label: "Sign out",
            icon: LogOut,
            onClick: () => void handleSignOut(),
            disabled: signingOut,
          },
        ]}
        actions={
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
          >
            <LogOut className="h-4 w-4" />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        }
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

      <Button
        type="button"
        variant="destructive"
        className="min-h-12 w-full"
        disabled={signingOut}
        onClick={() => void handleSignOut()}
      >
        <LogOut className="h-4 w-4" />
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
