import { isCapacitor, isElectron } from "@novend/hardware";
import { persistLastRoute } from "@/lib/auth/last-route";

/**
 * Update the address bar without Next soft navigation.
 * Cap/Electron client shells must not call `router.replace` for query-only
 * changes — that kicks an RSC flight and can remount StartupSplash forever.
 * Returns true when the URL was updated via history (caller should skip router).
 */
export function replaceClientShellUrl(href: string): boolean {
  if (typeof window === "undefined") return false;
  if (!isCapacitor() && !isElectron()) return false;
  try {
    window.history.replaceState(window.history.state ?? {}, "", href);
    persistLastRoute(href);
    return true;
  } catch {
    return false;
  }
}
