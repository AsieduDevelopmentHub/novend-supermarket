"use client";

import { useEffect } from "react";
import { recoverStaleClient } from "@/lib/auth/recover-auth-navigation";
import { isStaleClientError } from "@/lib/errors";

/**
 * Next paints its own "Server Action … was not found" toast for a page left
 * open across a deploy. That toast never goes through our sanitizer.
 * Reload once so the open page matches the server.
 */
export function StaleClientRecovery() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isStaleClientError(event.reason)) return;
      event.preventDefault();
      recoverStaleClient(event.reason);
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);
  return null;
}
