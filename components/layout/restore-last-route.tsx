"use client";

import { Suspense, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { FROM_BOOT_PARAM, readLastRoute, resolveFromBootTarget } from "@/lib/auth/last-route";
import { type AppRole } from "@/config/navigation";
import { useConnectivity } from "@/hooks/use-connectivity";
import { readOfflineSession } from "@/lib/offline/session";
import { isCapacitor } from "@novend/hardware";

/**
 * After Capacitor/Electron cold boot (marked with ?fromBoot=1), restore the
 * last in-app path from localStorage once the hosted origin is loaded.
 * Never restore /platform for a non–platform-admin session.
 * Cap/offline: use history + popstate so OfflineOutlet engages (not RSC).
 * Stripping fromBoot alone must not dispatch popstate (that remounted Dashboard).
 *
 * Not used after credential login — tenant sessions land on Dashboard;
 * platform administrators land on /platform.
 */
function RestoreLastRouteInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const online = useConnectivity();
  const me = useQuery(api.users.me, online ? {} : "skip");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (searchParams.get(FROM_BOOT_PARAM) !== "1") return;
    if (online && me === undefined) return;
    ran.current = true;

    const role =
      (me?.role as AppRole | undefined) ?? (readOfflineSession()?.role as AppRole | undefined);
    const target = resolveFromBootTarget({
      pathname,
      search: searchParams.toString(),
      last: readLastRoute(),
      role,
      isPlatformAdmin: Boolean(me?.isPlatformAdmin),
      platformOnly: Boolean(me?.isPlatformAdmin && !me?.role),
    });

    if (!target) return;

    const useClientShell = isCapacitor() || !online;
    if (useClientShell && typeof window !== "undefined") {
      window.history.replaceState({}, "", target.href);
      if (target.remount) {
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      return;
    }
    router.replace(target.href);
  }, [pathname, router, searchParams, online, me]);

  return null;
}

export function RestoreLastRoute() {
  return (
    <Suspense fallback={null}>
      <RestoreLastRouteInner />
    </Suspense>
  );
}
