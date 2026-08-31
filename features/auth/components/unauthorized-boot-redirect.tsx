"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FROM_BOOT_PARAM } from "@/lib/auth/last-route";
import { postLoginPath } from "@/lib/auth/post-login-path";

/** Cold start must never linger on the permission page. */
export function UnauthorizedBootRedirect() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get(FROM_BOOT_PARAM) !== "1") return;
    router.replace(postLoginPath(null));
  }, [router]);

  return null;
}
