"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { CircleHelp, LogOut, Menu, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { APP_BRAND } from "@/constants/app";
import { BRANDING } from "@/constants/branding";
import { PlatformNavTree } from "@/components/layout/platform-nav-tree";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useNativeShell } from "@/hooks/use-native-shell";
import { useStandaloneDisplay } from "@/hooks/use-standalone-display";
import { signOutAndRedirect } from "@/lib/auth/sign-out";
import { useOfflineNavigation } from "@/providers/offline-navigation";

export function PlatformShell({
  children,
  hasTenantRole = false,
  sessionName,
  sessionEmail,
}: {
  children: React.ReactNode;
  hasTenantRole?: boolean;
  sessionName?: string;
  sessionEmail?: string | null;
}) {
  const online = useConnectivity();
  const nativeShell = useNativeShell();
  const standalone = useStandaloneDisplay();
  const needsStatusPad = nativeShell || standalone;
  const session = useQuery(api.platform.me, online ? {} : "skip");
  const name = sessionName ?? session?.name ?? "Platform admin";
  const email = sessionEmail ?? session?.email ?? null;

  return (
    <div className="bg-background flex h-dvh max-h-dvh overflow-hidden">
      <aside
        data-tour="platform-navigation"
        className="border-sidebar-border bg-sidebar text-sidebar-foreground hidden w-[272px] shrink-0 flex-col border-r lg:flex"
      >
        <PlatformBrand />
        <div className="mx-4 h-px bg-white/10" />
        <PlatformNavTree className="min-h-0 flex-1 overflow-y-auto py-4" />
        {hasTenantRole ? (
          <div className="px-3 pb-2">
            <Link
              href="/dashboard"
              className="text-sidebar-foreground/80 flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium hover:bg-white/5 hover:text-white"
            >
              <Store className="h-4 w-4" />
              Open POS
            </Link>
          </div>
        ) : null}
        <PlatformSession name={name} email={email} />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {needsStatusPad ? <div className="app-status-bar lg:hidden" aria-hidden /> : null}
        <header className="border-border bg-card z-20 flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:hidden">
          <MobilePlatformNav
            hasTenantRole={hasTenantRole}
            sessionName={name}
            sessionEmail={email}
          />
          <Image
            src={BRANDING.brandmark}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
          <p className="truncate text-sm font-semibold tracking-[0.16em] uppercase">
            {APP_BRAND} platform
          </p>
        </header>
        <main
          data-novend-scroll-root
          className="min-h-0 flex-1 overflow-x-clip overflow-y-auto overscroll-y-contain px-4 py-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function PlatformBrand() {
  return (
    <Link href="/platform" className="flex items-center gap-3 px-4 py-5">
      <div className="relative h-10 w-10 shrink-0">
        <Image src={BRANDING.brandmark} alt="" fill className="object-contain" sizes="40px" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-[0.18em] uppercase">{APP_BRAND}</p>
        <p className="text-sidebar-muted truncate text-xs">Super Admin</p>
      </div>
    </Link>
  );
}

function PlatformSession({ name, email }: { name: string; email: string | null }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutAndRedirect({ signOut, router });
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className="border-sidebar-border mt-auto space-y-2 border-t p-3">
      <div className="px-2">
        <p className="truncate text-sm font-medium">{name}</p>
        {email ? <p className="text-sidebar-muted truncate text-xs">{email}</p> : null}
      </div>
      <Button asChild variant="ghost" className="text-sidebar-foreground w-full justify-start">
        <Link href="/platform/help">
          <CircleHelp className="h-4 w-4" />
          Help &amp; tours
        </Link>
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={signingOut}
        className="w-full justify-start bg-transparent text-white hover:bg-white/10 hover:text-white"
        onClick={() => void onSignOut()}
      >
        <LogOut className="h-4 w-4" />
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}

function MobilePlatformNav({
  hasTenantRole,
  sessionName,
  sessionEmail,
}: {
  hasTenantRole: boolean;
  sessionName: string;
  sessionEmail: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { activePath } = useOfflineNavigation();
  const routeKey = activePath ?? pathname;

  useEffect(() => {
    // Route changes are an external navigation event; close the transient sheet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [routeKey]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("a[href]")) return;
      setOpen(false);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="icon" data-tour="platform-navigation">
          <Menu className="h-4 w-4" />
          <span className="sr-only">Open platform menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="bg-sidebar text-sidebar-foreground w-72 border-0 p-0 pt-[var(--app-safe-top)]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{APP_BRAND} platform</SheetTitle>
        </SheetHeader>
        <div className="flex h-full flex-col">
          <PlatformBrand />
          <div className="mx-4 h-px bg-white/10" />
          <div className="min-h-0 flex-1 overflow-y-auto py-4">
            <PlatformNavTree onNavigate={() => setOpen(false)} />
            {hasTenantRole ? (
              <div className="px-3 pt-3">
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="text-sidebar-foreground/80 flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium hover:bg-white/5"
                >
                  <Store className="h-4 w-4" />
                  Open POS
                </Link>
              </div>
            ) : null}
          </div>
          <PlatformSession name={sessionName} email={sessionEmail} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
