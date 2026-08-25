"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { FROM_BOOT_PARAM, readLastRoute } from "@/lib/auth/last-route";
import { safeInternalPath } from "@/lib/auth/safe-return-path";
import { useConnectivity } from "@/hooks/use-connectivity";
import { isCapacitor } from "@novend/hardware";

/**
 * After Capacitor/Electron cold boot (marked with ?fromBoot=1), restore the
 * last in-app path from localStorage once the hosted origin is loaded.
 * Never restore /platform for a non–platform-admin session.
 * Cap/offline: use history + popstate so OfflineOutlet engages (not RSC).
 */
export function RestoreLastRoute() {
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

    const last = readLastRoute();
    const params = new URLSearchParams(searchParams.toString());
    params.delete(FROM_BOOT_PARAM);
    const cleanedSearch = params.toString();
    const cleanedCurrent = cleanedSearch ? `${pathname}?${cleanedSearch}` : pathname;

    const safe = last ? safeInternalPath(last) : null;
    const isPlatformPath = Boolean(
      safe && (safe === "/platform" || safe.startsWith("/platform/")),
    );
    const canRestorePlatform = Boolean(me?.isPlatformAdmin);
    const allowed = safe && (!isPlatformPath || canRestorePlatform) ? safe : null;

    const target =
      allowed && allowed !== cleanedCurrent
        ? allowed
        : cleanedCurrent !==
            `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
          ? cleanedCurrent
          : null;

    if (!target) return;

    const useClientShell = isCapacitor() || !online;
    if (useClientShell && typeof window !== "undefined") {
      window.history.replaceState({}, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }
    router.replace(target);
  }, [pathname, router, searchParams, online, me]);

  return null;
}
