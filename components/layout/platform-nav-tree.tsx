"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ChevronRight } from "lucide-react";
import {
  PLATFORM_NAV_GROUPS,
  findPlatformNavGroupForPath,
  platformNavItemActive,
  type PlatformNavGroup,
  type PlatformNavItem,
} from "@/config/platform-navigation";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePlatformNavTreeState } from "@/hooks/use-platform-nav-tree-state";
import { useOfflineNavigation } from "@/providers/offline-navigation";
import { cn } from "@/lib/utils";

function PlatformNavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: PlatformNavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const online = useConnectivity();
  const { navigate, activePath } = useOfflineNavigation();
  const currentPath = activePath ?? pathname;
  const active = platformNavItemActive(currentPath, item);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={(event) => {
        onNavigate?.();
        if (online || item.href === currentPath) return;
        event.preventDefault();
        navigate(item.href);
      }}
      className={cn(
        "flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-white/10 text-white ring-1 ring-[#38bdf8]/45"
          : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-white",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#38bdf8]" : null)} />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

function PlatformNavGroupLinks({
  group,
  pathname,
  onNavigate,
}: {
  group: PlatformNavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const online = useConnectivity();
  const { navigate, activePath } = useOfflineNavigation();
  const currentPath = activePath ?? pathname;

  return (
    <div className="flex flex-col gap-0.5 pb-1 pl-3">
      {group.items.map((item) => {
        const active = platformNavItemActive(currentPath, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={(event) => {
              onNavigate?.();
              if (online || item.href === currentPath) return;
              event.preventDefault();
              navigate(item.href);
            }}
            className={cn(
              "relative flex items-center gap-2.5 rounded-full py-2 pr-3 pl-6 text-sm font-medium transition-colors",
              active
                ? "bg-white/10 text-white ring-1 ring-[#38bdf8]/45"
                : "text-sidebar-foreground/75 hover:bg-white/5 hover:text-white",
            )}
          >
            <span
              className={cn(
                "absolute top-1/2 left-3 h-1 w-1 -translate-y-1/2 rounded-full",
                active ? "bg-[#38bdf8]" : "bg-sidebar-foreground/35",
              )}
              aria-hidden
            />
            <span className="truncate">{item.title}</span>
          </Link>
        );
      })}
    </div>
  );
}

function PlatformNavGroupSection({
  group,
  pathname,
  expanded,
  onToggle,
  onNavigate,
}: {
  group: PlatformNavGroup;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const { activePath } = useOfflineNavigation();
  const currentPath = activePath ?? pathname;
  const hasActiveChild = group.items.some((item) => platformNavItemActive(currentPath, item));
  const singleItem = group.items.length === 1;

  if (singleItem) {
    const item = group.items[0]!;
    return (
      <div className="space-y-0.5">
        <p className="text-sidebar-muted px-3 pb-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
          {group.label}
        </p>
        <PlatformNavLink item={item} pathname={pathname} onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          "text-sidebar-foreground/90 hover:bg-white/5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors",
          hasActiveChild && "text-white",
        )}
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200 ease-out",
            expanded ? "rotate-90" : "rotate-0",
          )}
          aria-hidden
        />
        <span className="truncate">{group.label}</span>
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <PlatformNavGroupLinks group={group} pathname={pathname} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

export function PlatformNavTree({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const { activePath } = useOfflineNavigation();
  const currentPath = activePath ?? pathname;
  const { isExpanded, toggleGroup, expandGroup } = usePlatformNavTreeState();

  useEffect(() => {
    const activeGroup = findPlatformNavGroupForPath(currentPath);
    if (activeGroup) expandGroup(activeGroup);
  }, [currentPath, expandGroup]);

  return (
    <nav className={cn("flex flex-col gap-3 px-3", className)}>
      {PLATFORM_NAV_GROUPS.map((group) => (
        <PlatformNavGroupSection
          key={group.id}
          group={group}
          pathname={currentPath}
          expanded={isExpanded(group.id)}
          onToggle={() => toggleGroup(group.id)}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}
