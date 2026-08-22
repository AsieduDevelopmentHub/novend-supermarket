"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Building2, LayoutDashboard, LogOut, Menu, Package, Store } from "lucide-react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { APP_BRAND } from "@/constants/app";
import { BRANDING } from "@/constants/branding";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { signOutAndRedirect } from "@/lib/auth/sign-out";

const NAV = [
  { href: "/platform", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/platform/organizations", label: "Organizations", icon: Building2, exact: false },
  { href: "/platform/releases", label: "Desktop releases", icon: Package, exact: false },
] as const;

function navActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PlatformShell({
  children,
  hasTenantRole = false,
}: {
  children: React.ReactNode;
  hasTenantRole?: boolean;
}) {
  const pathname = usePathname();
  const session = useQuery(api.platform.me, {});

  return (
    <div className="bg-background flex h-dvh max-h-dvh overflow-hidden">
      <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground hidden w-[272px] shrink-0 flex-col border-r lg:flex">
        <PlatformBrand />
        <div className="mx-4 h-px bg-white/10" />
        <PlatformNav pathname={pathname} className="flex-1 py-4" />
        {hasTenantRole ? (
          <div className="px-3 pb-2">
            <Link
              href="/dashboard"
              className="text-sidebar-foreground/80 hover:bg-white/5 hover:text-white flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium"
            >
              <Store className="h-4 w-4" />
              Open POS
            </Link>
          </div>
        ) : null}
        <PlatformSession
          name={session?.name ?? "Platform admin"}
          email={session?.email ?? null}
        />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-border bg-card z-20 flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:hidden">
          <MobilePlatformNav hasTenantRole={hasTenantRole} />
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
        <main className="min-h-0 flex-1 overflow-x-clip overflow-y-auto overscroll-y-contain px-4 py-6 lg:px-8">
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

function PlatformNav({ pathname, className }: { pathname: string; className?: string }) {
  return (
    <nav className={cn("flex flex-col gap-1 px-3", className)}>
      {NAV.map((item) => {
        const active = navActive(pathname, item.href, item.exact);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-white/10 text-white ring-1 ring-[#38bdf8]/45"
                : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#38bdf8]" : null)} />
            {item.label}
          </Link>
        );
      })}
    </nav>
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

function MobilePlatformNav({ hasTenantRole }: { hasTenantRole: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const session = useQuery(api.platform.me, {});

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="icon">
          <Menu className="h-4 w-4" />
          <span className="sr-only">Open platform menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-sidebar text-sidebar-foreground w-72 border-0 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{APP_BRAND} platform</SheetTitle>
        </SheetHeader>
        <div className="flex h-full flex-col">
          <PlatformBrand />
          <div className="mx-4 h-px bg-white/10" />
          <div className="flex-1 py-4" onClick={() => setOpen(false)}>
            <PlatformNav pathname={pathname} />
            {hasTenantRole ? (
              <div className="px-3 pt-2">
                <Link
                  href="/dashboard"
                  className="text-sidebar-foreground/80 hover:bg-white/5 flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium"
                >
                  <Store className="h-4 w-4" />
                  Open POS
                </Link>
              </div>
            ) : null}
          </div>
          <PlatformSession
            name={session?.name ?? "Platform admin"}
            email={session?.email ?? null}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
