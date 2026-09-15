"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import {
  SETTINGS_ITEM,
  findNavGroupForPath,
  navGroupsForRole,
  type AppRole,
  type NavGroup,
  type NavItem,
} from "@/config/navigation";
import { useNavTreeState } from "@/hooks/use-nav-tree-state";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import { useOfflineNavigation } from "@/providers/offline-navigation";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

function SidebarNavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { navigate, activePath } = useOfflineNavigation();
  const pathname = usePathname();
  const currentPath = activePath ?? pathname;
  const Icon = item.icon;

  return (
    <NavTooltip label={item.title} enabled={Boolean(collapsed)}>
      <Link
        href={item.href}
        onClick={(event) => {
          onNavigate?.();
          event.preventDefault();
          if (item.href === currentPath) return;
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
        {collapsed ? (
          <span className="sr-only">{item.title}</span>
        ) : (
          <span className="truncate">{item.title}</span>
        )}
      </Link>
    </NavTooltip>
  );
}

function NavGroupLinks({
  group,
  currentPath,
  onNavigate,
}: {
  group: NavGroup;
  currentPath: string;
  onNavigate?: () => void;
}) {
  const { navigate } = useOfflineNavigation();

  return (
    <div className="flex flex-col gap-0.5 pb-1 pl-3">
      {group.items.map((item) => {
        const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={(event) => {
              onNavigate?.();
              event.preventDefault();
              if (item.href === currentPath) return;
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

function NavGroupSection({
  group,
  currentPath,
  collapsed,
  expanded,
  onToggle,
  onNavigate,
}: {
  group: NavGroup;
  currentPath: string;
  collapsed?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const hasActiveChild = group.items.some(
    (item) => currentPath === item.href || currentPath.startsWith(`${item.href}/`),
  );
  const singleItem = group.items.length === 1;

  if (collapsed) {
    return (
      <div className="flex flex-col gap-1">
        {group.items.map((item) => {
          const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
          return (
            <SidebarNavLink
              key={item.href}
              item={item}
              active={active}
              collapsed
              onNavigate={onNavigate}
            />
          );
        })}
      </div>
    );
  }

  if (singleItem) {
    const item = group.items[0]!;
    const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
    return (
      <div className="space-y-0.5">
        <p className="text-sidebar-muted px-3 pb-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
          {group.label}
        </p>
        <SidebarNavLink item={item} active={active} onNavigate={onNavigate} />
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
          "text-sidebar-foreground/90 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-white/5",
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
          <NavGroupLinks group={group} currentPath={currentPath} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

export function SidebarNavTree({
  role,
  collapsed,
  onNavigate,
}: {
  role: AppRole;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { activePath } = useOfflineNavigation();
  const { enabledCapabilities } = useBusinessCapabilities();
  const currentPath = activePath ?? pathname;
  const groups = navGroupsForRole(role, enabledCapabilities);
  const { isExpanded, toggleGroup, expandGroup } = useNavTreeState();

  useEffect(() => {
    const activeGroup = findNavGroupForPath(currentPath);
    if (activeGroup) expandGroup(activeGroup);
  }, [currentPath, expandGroup]);

  return (
    <nav className={cn("flex flex-col gap-3", collapsed ? "px-2" : "px-3")}>
      {groups.map((group) => (
        <NavGroupSection
          key={group.id}
          group={group}
          currentPath={currentPath}
          collapsed={collapsed}
          expanded={isExpanded(group.id)}
          onToggle={() => toggleGroup(group.id)}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

export function SidebarSettingsLink({
  role,
  collapsed,
  onNavigate,
}: {
  role: AppRole;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { activePath } = useOfflineNavigation();
  const currentPath = activePath ?? pathname;

  if (!SETTINGS_ITEM.roles.includes(role)) return null;

  const active =
    currentPath === SETTINGS_ITEM.href || currentPath.startsWith(`${SETTINGS_ITEM.href}/`);

  return (
    <div className={cn("shrink-0", collapsed ? "px-2" : "px-3")}>
      <div className={cn("mb-2 h-px bg-white/10", collapsed ? "mx-0" : "mx-1")} />
      <SidebarNavLink
        item={SETTINGS_ITEM}
        active={active}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
    </div>
  );
}
