"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { triggerLightHaptic } from "@/lib/haptics";
import { MOBILE_BOTTOM_TABS, resolveMobileTab } from "@/config/mobile-navigation";
import { useOfflineNavigation } from "@/providers/offline-navigation";

/**
 * Capacitor-only bottom navigation — curved Onyx bar with candy-blue active orb.
 * Routes and highlight logic stay in `config/mobile-navigation`.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { navigate, activePath } = useOfflineNavigation();
  const pathForHighlight = activePath ?? pathname;
  const active = resolveMobileTab(pathForHighlight);

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 xl:hidden"
    >
      <div className="novend-mobile-tabbar pointer-events-auto">
        <div className="novend-mobile-tabbar-inner">
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
                className={cn("novend-mobile-tab", isActive ? "text-white" : "text-slate-400")}
              >
                <span className="novend-mobile-tab-icon">
                  <span
                    aria-hidden
                    className={cn(
                      "novend-mobile-tab-orb",
                      isActive && "novend-mobile-tab-orb-active",
                    )}
                  />
                  <Icon
                    className={cn(
                      "relative z-10 h-5 w-5 transition-colors duration-200",
                      isActive ? "text-slate-950" : "text-current",
                    )}
                    aria-hidden
                  />
                </span>
                <span className="novend-mobile-tab-label">{tab.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
