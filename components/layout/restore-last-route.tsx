"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FROM_BOOT_PARAM, readLastRoute } from "@/lib/auth/last-route";
import { safeInternalPath } from "@/lib/auth/safe-return-path";

/**
 * After Capacitor/Electron cold boot (marked with ?fromBoot=1), restore the
 * last in-app path from localStorage once the hosted origin is loaded.
 */
export function RestoreLastRoute() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (searchParams.get(FROM_BOOT_PARAM) !== "1") return;
    ran.current = true;

    const last = readLastRoute();
    const params = new URLSearchParams(searchParams.toString());
    params.delete(FROM_BOOT_PARAM);
    const cleanedSearch = params.toString();
    const cleanedCurrent = cleanedSearch ? `${pathname}?${cleanedSearch}` : pathname;

    if (last && safeInternalPath(last) && last !== cleanedCurrent) {
      router.replace(last);
      return;
    }

    if (cleanedCurrent !== `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`) {
      router.replace(cleanedCurrent);
    }
  }, [pathname, router, searchParams]);

  return null;
}
