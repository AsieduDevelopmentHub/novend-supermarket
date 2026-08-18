"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { ChevronRight, LogOut, Menu } from "lucide-react";
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
import { useConnectivity } from "@/hooks/use-connectivity";
import { useOfflineNavigation } from "@/providers/offline-navigation";
import { clearOfflineSession } from "@/lib/offline/session";
import { clearShellProfile } from "@/lib/offline/shell-profile";
import { useState } from "react";

type ShellUser = {
  name: string;
  role: AppRole;
  branch: string;
  imageUrl?: string | null;
  organizationName?: string | null;
  isPlatformAdmin?: boolean;
};

function NavLinks({ role, onNavigate }: { role: AppRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  const online = useConnectivity();
  const { navigate, activePath } = useOfflineNavigation();
  const currentPath = activePath ?? pathname;
  const items = navForRole(role);

  return (
    <nav className="flex flex-1 flex-col gap-1.5 px-3">
      {items.map((item) => {
        const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
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
              "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            {active ? (
              <span className="bg-sidebar-primary absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full" />
            ) : null}
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBrand({ businessName }: { businessName: string }) {
  return (
    <div className="border-sidebar-border flex items-center gap-3 border-b px-4 py-5">
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
      <div className="min-w-0">
        <p className="text-sidebar-foreground truncate text-lg leading-tight font-semibold tracking-tight">
          {businessName}
        </p>
        <p className="text-sidebar-muted truncate text-xs">{APP_BRAND} POS</p>
      </div>
    </div>
  );
}

function SidebarUser({ user }: { user: ShellUser }) {
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
            className="hover:bg-sidebar-accent flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors"
          >
            <Avatar className="border-sidebar-border h-10 w-10 border">
              {user.imageUrl ? <AvatarImage src={user.imageUrl} alt="" /> : null}
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sidebar-accent-foreground truncate text-sm font-medium">
                {user.name}
              </p>
              <p className="text-sidebar-muted truncate text-xs capitalize">
                {user.role} — {user.branch}
              </p>
            </div>
            <ChevronRight className="text-sidebar-muted h-4 w-4 shrink-0" />
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

function SidebarBody({ user, onNavigate }: { user: ShellUser; onNavigate?: () => void }) {
  const businessName = user.organizationName?.trim() || APP_BRAND;
  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full flex-col">
      <SidebarBrand businessName={businessName} />
      <div className="flex-1 overflow-y-auto py-4">
        <NavLinks role={user.role} onNavigate={onNavigate} />
        {user.isPlatformAdmin ? (
          <div className="px-3 pt-3">
            <Link
              href="/platform"
              onClick={() => onNavigate?.()}
              className="text-sidebar-foreground/85 hover:bg-sidebar-accent flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
            >
              Platform
            </Link>
          </div>
        ) : null}
      </div>
      <SidebarUser user={user} />
    </div>
  );
}

export function AppSidebar({ user }: { user: ShellUser }) {
  return (
    <aside className="hidden h-full w-64 shrink-0 overflow-hidden lg:block">
      <SidebarBody user={user} />
    </aside>
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
