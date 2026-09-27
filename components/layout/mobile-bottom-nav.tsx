"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { triggerLightHaptic } from "@/lib/haptics";
import { mobileBottomTabsForIndustry, resolveMobileTab } from "@/config/mobile-navigation";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import { useOfflineNavigation } from "@/providers/offline-navigation";

/**
 * Capacitor-only bottom navigation — curved Onyx bar with candy-blue active orb.
 * Routes and highlight logic stay in `config/mobile-navigation`.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { navigate, activePath } = useOfflineNavigation();
  const { industryProfile } = useBusinessCapabilities();
  const tabs = mobileBottomTabsForIndustry(industryProfile);
  const pathForHighlight = activePath ?? pathname;
  const active = resolveMobileTab(pathForHighlight);

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 w-full max-w-[100svw] xl:hidden"
    >
      <div
        className="novend-mobile-tabbar pointer-events-auto"
        data-tour="mobile-bottom-navigation"
      >
        <div className="novend-mobile-tabbar-inner">
          {tabs.map((tab) => {
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
                data-tour={tab.id === "more" ? "mobile-more" : undefined}
                className={cn(
                  "novend-mobile-tab",
                  isActive ? "novend-mobile-tab-active text-white" : "text-slate-300",
                  tab.id === "sales" && !isActive && "novend-mobile-tab-sales",
                )}
              >
                {isActive ? <span className="novend-mobile-tab-notch" aria-hidden /> : null}
                <span
                  className={cn(
                    "novend-mobile-tab-icon",
                    isActive && "novend-mobile-tab-icon-active",
                  )}
                >
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
