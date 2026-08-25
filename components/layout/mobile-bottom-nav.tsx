"use client";

import type { CSSProperties } from "react";
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
  const activeIndex = Math.max(
    0,
    MOBILE_BOTTOM_TABS.findIndex((tab) => tab.id === active),
  );
  const notchX = `${((activeIndex + 0.5) / MOBILE_BOTTOM_TABS.length) * 100}%`;
  const activeTab = MOBILE_BOTTOM_TABS[activeIndex];
  const ActiveIcon = activeTab.icon;

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 xl:hidden"
    >
      <div
        className="novend-mobile-tabbar pointer-events-auto"
        style={{ "--active-notch-x": notchX } as CSSProperties}
      >
        <div className="novend-mobile-tabbar-notch" aria-hidden />
        <div className="novend-mobile-tabbar-stone" aria-hidden>
          <span className="novend-mobile-tab-orb novend-mobile-tab-orb-active" />
          <ActiveIcon className="relative z-10 h-5 w-5 text-slate-950" />
        </div>
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
                className={cn(
                  "novend-mobile-tab",
                  isActive ? "novend-mobile-tab-active text-white" : "text-slate-300",
                )}
              >
                <span
                  className={cn(
                    "novend-mobile-tab-icon",
                    isActive && "novend-mobile-tab-icon-active",
                  )}
                >
                  {!isActive ? (
                    <>
                      <span aria-hidden className="novend-mobile-tab-orb" />
                      <Icon
                        className="relative z-10 h-5 w-5 text-current transition-colors duration-200"
                        aria-hidden
                      />
                    </>
                  ) : (
                    <span className="novend-mobile-tab-icon-spacer" aria-hidden />
                  )}
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
