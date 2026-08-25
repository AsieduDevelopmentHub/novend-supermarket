"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, LogOut, Menu, Shield } from "lucide-react";
import type { AppRole } from "@/config/navigation";
import { SidebarNavTree, SidebarSettingsLink } from "@/components/layout/sidebar-nav-tree";
import { APP_BRAND } from "@/constants/app";
import { BRANDING } from "@/constants/branding";
import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SyncStatusChip } from "@/components/offline/sync-status-chip";
import { signOutAndRedirect } from "@/lib/auth/sign-out";
import { useOfflineNavigation } from "@/providers/offline-navigation";

const SIDEBAR_COLLAPSED_KEY = "novend.sidebarCollapsed";

type ShellUser = {
  name: string;
  role: AppRole;
  branch: string;
  imageUrl?: string | null;
  organizationName?: string | null;
  isPlatformAdmin?: boolean;
};

function subscribeSidebarCollapsed(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("novend-sidebar-collapsed", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("novend-sidebar-collapsed", onStoreChange);
  };
}

function readSidebarCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function useCollapsedSidebar() {
  const collapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    readSidebarCollapsed,
    () => false,
  );

  function toggle() {
    const next = !readSidebarCollapsed();
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // Ignore quota / privacy errors.
    }
    window.dispatchEvent(new Event("novend-sidebar-collapsed"));
  }

  return { collapsed, toggle };
}

function NavTooltip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: ReactNode;
}) {
  if (!enabled) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function SidebarBrand({
  businessName,
  collapsed,
  onToggle,
}: {
  businessName: string;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-2 py-4", collapsed ? "flex-col px-2" : "px-3")}>
      <div className="relative h-11 w-11 shrink-0">
        <Image
          src={BRANDING.brandmark}
          alt=""
          fill
          priority
          className="object-contain"
          sizes="44px"
        />
      </div>
      {collapsed ? (
        <span className="sr-only">{businessName}</span>
      ) : (
        <div className="min-w-0 flex-1">
          <p className="text-sidebar-foreground truncate text-base leading-tight font-semibold tracking-tight">
            {businessName}
          </p>
          <p className="text-sidebar-muted truncate text-xs">{APP_BRAND} POS</p>
        </div>
      )}
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="text-sidebar-foreground hover:bg-white/10 hover:text-white flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      ) : null}
    </div>
  );
}

function SidebarUser({ user, collapsed }: { user: ShellUser; collapsed?: boolean }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const clearPresence = useMutation(api.users.clearPresence);
  const [signingOut, setSigningOut] = useState(false);
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutAndRedirect({
        signOut,
        router,
        clearPresence: () => clearPresence({}),
      });
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className="border-sidebar-border mt-auto border-t p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "hover:bg-white/5 flex w-full items-center rounded-full py-2 text-left transition-colors",
              collapsed ? "justify-center px-0" : "gap-3 px-2",
            )}
          >
            <Avatar className="border-sidebar-border h-10 w-10 border">
              {user.imageUrl ? <AvatarImage src={user.imageUrl} alt="" /> : null}
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            {collapsed ? (
              <span className="sr-only">{user.name}</span>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-sidebar-accent-foreground truncate text-sm font-medium">
                    {user.name}
                  </p>
                  <p className="text-sidebar-muted truncate text-xs capitalize">
                    {user.role} — {user.branch}
                  </p>
                </div>
                <ChevronRight className="text-sidebar-muted h-4 w-4 shrink-0" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span>{user.name}</span>
              <span className="text-muted-foreground text-xs font-normal capitalize">
                {user.role} · {user.branch}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={signingOut} onClick={() => void onSignOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            {signingOut ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SidebarBody({
  user,
  onNavigate,
  collapsed,
  onToggle,
}: {
  user: ShellUser;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const businessName = user.organizationName?.trim() || APP_BRAND;
  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full flex-col">
      <SidebarBrand businessName={businessName} collapsed={collapsed} onToggle={onToggle} />
      <div className={cn("h-px bg-white/10", collapsed ? "mx-2" : "mx-4")} />
      <div className="min-h-0 flex-1 overflow-y-auto py-4">
        <SidebarNavTree role={user.role} onNavigate={onNavigate} collapsed={collapsed} />
        {user.isPlatformAdmin ? (
          <div className={cn("pt-3", collapsed ? "px-2" : "px-3")}>
            <NavTooltip label="Platform" enabled={Boolean(collapsed)}>
              <Link
                href="/platform"
                onClick={() => onNavigate?.()}
                className={cn(
                  "text-sidebar-foreground/80 hover:bg-white/5 hover:text-white flex items-center rounded-full py-2 text-sm font-medium",
                  collapsed ? "justify-center px-0" : "gap-3 px-3",
                )}
              >
                <Shield className="h-4 w-4 shrink-0" />
                {collapsed ? <span className="sr-only">Platform</span> : <span>Platform</span>}
              </Link>
            </NavTooltip>
          </div>
        ) : null}
      </div>
      <SidebarSettingsLink role={user.role} collapsed={collapsed} onNavigate={onNavigate} />
      <SyncStatusChip collapsed={collapsed} />
      <SidebarUser user={user} collapsed={collapsed} />
    </div>
  );
}

export function AppSidebar({ user }: { user: ShellUser }) {
  const { collapsed, toggle } = useCollapsedSidebar();

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "border-sidebar-border relative hidden h-full shrink-0 border-r transition-[width] duration-200 lg:block",
          collapsed ? "w-[76px]" : "w-[272px]",
        )}
      >
        <SidebarBody user={user} collapsed={collapsed} onToggle={toggle} />
      </aside>
    </TooltipProvider>
  );
}

export function MobileSidebar({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { activePath } = useOfflineNavigation();
  const routeKey = activePath ?? pathname;

  // Offline nav intercepts <a> clicks in capture phase, so Link onClick/onNavigate
  // often never runs — close on route change and on any in-sheet link click.
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
        <Button type="button" variant="outline" size="icon" className="lg:hidden">
          <Menu className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-sidebar text-sidebar-foreground w-72 border-0 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{APP_BRAND}</SheetTitle>
        </SheetHeader>
        <SidebarBody user={user} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
