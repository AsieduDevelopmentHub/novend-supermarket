"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { usePermissions } from "@/hooks/use-permissions";
import { moreSectionsForRole } from "@/config/mobile-navigation";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import { useLicense } from "@/hooks/use-license";
import { isBillingHidden } from "@/config/navigation";
import type { AppRole } from "@/config/navigation";
import { readOfflineSession } from "@/lib/offline/session";
import { PageHeader } from "@/components/layout/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { usePublicSiteHref } from "@/features/auth/components/public-site-host";
import { signOutAndRedirect } from "@/lib/auth/sign-out";
import { isLegalPath } from "@/lib/marketing-routes";
import { ChevronRight, CreditCard, HelpCircle, Info, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

function PublicOrAppLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  const resolved = usePublicSiteHref(href);
  const publicDoc = isLegalPath(href) || href.startsWith("/docs");
  if (publicDoc) {
    return (
      <a href={isLegalPath(href) ? resolved : href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

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
  const { enabledCapabilities } = useBusinessCapabilities();
  const { features, billingVisibility } = useLicense();
  const billingHidden = isBillingHidden({ features, billingVisibility });
  const [signingOut, setSigningOut] = useState(false);
  const [sessionRole] = useState<AppRole | null>(() => {
    const stored = readOfflineSession()?.role;
    return stored === "administrator" || stored === "manager" || stored === "cashier"
      ? stored
      : null;
  });
  const effectiveRole = role ?? sessionRole;

  if (isLoading && !effectiveRole) {
    return <LoadingState label="Opening More…" />;
  }

  const sections = moreSectionsForRole(effectiveRole ?? "cashier", enabledCapabilities, {
    features,
    billingVisibility,
  });
  const hasSystemSection = sections.some((section) => section.id === "system");
  const systemExtras = EXTRA_SYSTEM.filter(
    (item) => !(billingHidden && item.href.includes("section=billing")),
  );

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutAndRedirect({ signOut, router });
    } finally {
      setSigningOut(false);
    }
  }

  function renderSignOutRow() {
    return (
      <button
        type="button"
        disabled={signingOut}
        onClick={() => void handleSignOut()}
        className={cn(
          "flex min-h-12 w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left transition-colors",
          "text-destructive hover:bg-destructive/10 active:bg-destructive/15",
          "disabled:pointer-events-none disabled:opacity-60",
        )}
      >
        <span className="bg-destructive/10 text-destructive flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]">
          <LogOut className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {signingOut ? "Signing out…" : "Sign out"}
        </span>
      </button>
    );
  }

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
            {section.id === "system" ? (
              <>
                {systemExtras.map((item) => {
                  const Icon = item.icon;
                  return (
                    <PublicOrAppLink
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
                    </PublicOrAppLink>
                  );
                })}
                {renderSignOutRow()}
              </>
            ) : null}
          </CardContent>
        </Card>
      ))}

      {!hasSystemSection ? (
        <Card className="overflow-hidden rounded-[20px]">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 px-2 pb-3">
            {systemExtras.map((item) => {
              const Icon = item.icon;
              return (
                <PublicOrAppLink
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
                </PublicOrAppLink>
              );
            })}
            {renderSignOutRow()}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
