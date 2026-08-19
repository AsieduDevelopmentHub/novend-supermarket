"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Shield } from "lucide-react";
import { navForRole, type AppRole } from "@/config/navigation";
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
import { useConnectivity } from "@/hooks/use-connectivity";
import { useOfflineNavigation } from "@/providers/offline-navigation";
import { clearOfflineSession } from "@/lib/offline/session";
import { clearShellProfile } from "@/lib/offline/shell-profile";

const SIDEBAR_COLLAPSED_KEY = "novend.sidebarCollapsed";

type ShellUser = {
  name: string;
  role: AppRole;
  branch: string;
  imageUrl?: string | null;
  organizationName?: string | null;
  isPlatformAdmin?: boolean;
};

function useCollapsedSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      // localStorage may be blocked; stay expanded.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      // Ignore quota / privacy errors.
    }
  }, [collapsed, ready]);

  return {
    collapsed,
    toggle: () => setCollapsed((value) => !value),
  };
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

function NavLinks({
  role,
  onNavigate,
  collapsed,
}: {
  role: AppRole;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const online = useConnectivity();
  const { navigate, activePath } = useOfflineNavigation();
  const currentPath = activePath ?? pathname;
  const items = navForRole(role);

  return (
    <nav className={cn("flex flex-1 flex-col gap-1", collapsed ? "px-2" : "px-3")}>
      {items.map((item) => {
        const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <NavTooltip key={item.href} label={item.title} enabled={Boolean(collapsed)}>
            <Link
              href={item.href}
              onClick={(event) => {
                onNavigate?.();
                if (online || item.href === currentPath) return;

                // Soft RSC navigations fail offline and blank the shell. Keep the
                // authenticated layout mounted and swap feature views client-side.
                event.preventDefault();
                navigate(item.href);
              }}
              className={cn(
                "flex items-center rounded-full py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                active
                  ? "bg-white/10 text-white ring-1 ring-[#38bdf8]/45"
                  : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#38bdf8]" : null)} />
              {collapsed ? <span className="sr-only">{item.title}</span> : <span>{item.title}</span>}
            </Link>
          </NavTooltip>
        );
      })}
    </nav>
  );
}

function SidebarBrand({ businessName, collapsed }: { businessName: string; collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 py-5", collapsed ? "justify-center px-2" : "px-4")}>
      <div className="relative h-12 w-12 shrink-0">
        <Image
          src={BRANDING.brandmark}
          alt=""
          fill
          priority
          className="object-contain"
          sizes="48px"
        />
      </div>
      {collapsed ? (
        <span className="sr-only">{businessName}</span>
      ) : (
        <div className="min-w-0">
          <p className="text-sidebar-foreground truncate text-lg leading-tight font-semibold tracking-tight">
            {businessName}
          </p>
          <p className="text-sidebar-muted truncate text-xs">{APP_BRAND} POS</p>
        </div>
      )}
    </div>
  );
}

function SidebarUser({ user, collapsed }: { user: ShellUser; collapsed?: boolean }) {
  const { signOut } = useAuthActions();
  const clearPresence = useMutation(api.users.clearPresence);
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function onSignOut() {
    try {
      await clearPresence({});
    } catch {
      // Presence clear is best-effort before ending the session.
    }
    clearOfflineSession();
    await clearShellProfile();
    await signOut();
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
          <DropdownMenuItem onClick={() => void onSignOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
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
}: {
  user: ShellUser;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const businessName = user.organizationName?.trim() || APP_BRAND;
  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full flex-col">
      <SidebarBrand businessName={businessName} collapsed={collapsed} />
      <div className={cn("h-px bg-white/10", collapsed ? "mx-2" : "mx-4")} />
      <div className="flex-1 overflow-y-auto py-4">
        <NavLinks role={user.role} onNavigate={onNavigate} collapsed={collapsed} />
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
        <SidebarBody user={user} collapsed={collapsed} />
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="border-border bg-card text-foreground hover:bg-muted absolute top-6 -right-3 z-30 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm"
        >
          {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </aside>
    </TooltipProvider>
  );
}

export function MobileSidebar({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
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
