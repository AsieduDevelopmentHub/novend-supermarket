"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { recoverStaleClient } from "@/lib/auth/recover-auth-navigation";
import { isConnectivityError, isStaleClientError } from "@/lib/errors";

const STALE_TOAST_ID = "stale-client";

/**
 * Catch browser rejections that must not become Sentry noise or raw toasts:
 *
 * 1. Convex Auth `invalidateCache` Server Action id after a deploy (stale client).
 * 2. `TypeError: Failed to fetch` from Next prefetch / flaky Electron radio —
 *    those are expected when the till is mid-reconnect and must not surface as
 *    unhandledrejection alerts.
 */
export function StaleClientRecovery() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isStaleClientError(event.reason)) {
        event.preventDefault();
        toast.dismiss(STALE_TOAST_ID);
        recoverStaleClient(event.reason);
        return;
      }
      if (isConnectivityError(event.reason)) {
        event.preventDefault();
      }
    };

    const originalError = toast.error.bind(toast);
    toast.error = ((message: unknown, data?: Parameters<typeof toast.error>[1]) => {
      const description =
        data && typeof data === "object" && "description" in data
          ? (data as { description?: unknown }).description
          : undefined;
      if (isStaleClientError(message) || isStaleClientError(description)) {
        recoverStaleClient(message);
        return originalError(
          "Novend needs a quick refresh to load the latest version. Your saved work is safe on this device.",
          { id: STALE_TOAST_ID, duration: 6_000 },
        );
      }
      return originalError(message as never, data);
    }) as typeof toast.error;

    const observer = new MutationObserver(() => {
      const nodes = document.querySelectorAll("[data-sonner-toast]");
      for (const node of Array.from(nodes)) {
        const text = node.textContent ?? "";
        if (!isStaleClientError(text)) continue;
        toast.dismiss();
        recoverStaleClient(text);
        break;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      observer.disconnect();
      toast.error = originalError;
    };
  }, []);
  return null;
}
