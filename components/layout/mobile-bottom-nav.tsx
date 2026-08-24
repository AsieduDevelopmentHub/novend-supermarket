"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { triggerLightHaptic } from "@/lib/haptics";
import { MOBILE_BOTTOM_TABS, resolveMobileTab } from "@/config/mobile-navigation";
import { useOfflineNavigation } from "@/providers/offline-navigation";

/**
 * Floating Onyx bottom navigation for Capacitor only.
 * Candy Blue active indicator; haptic on tab change.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { navigate, activePath } = useOfflineNavigation();
  const pathForHighlight = activePath ?? pathname;
  const active = resolveMobileTab(pathForHighlight);

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 xl:hidden"
    >
      <div
        className={cn(
          "pointer-events-auto flex w-full max-w-lg items-stretch gap-0.5 rounded-[22px] px-1.5 py-1.5",
          "bg-[#111827] text-slate-200 shadow-[0_12px_40px_rgba(15,23,42,0.35)]",
          "ring-1 ring-white/10",
        )}
      >
        {MOBILE_BOTTOM_TABS.map((tab) => {
          const isActive = active === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                if (!isActive) void triggerLightHaptic();
                navigate(tab.href);
              }}
              className={cn(
                "relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[18px] px-1 py-1.5 text-[10px] font-medium transition-colors",
                isActive ? "text-white" : "text-slate-400 hover:text-slate-200",
              )}
            >
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute inset-x-2 top-1 h-0.5 rounded-full bg-[#38bdf8]"
                />
              ) : null}
              <Icon
                className={cn("h-5 w-5", isActive ? "text-[#38bdf8]" : "text-current")}
                aria-hidden
              />
              <span className="truncate">{tab.title}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
