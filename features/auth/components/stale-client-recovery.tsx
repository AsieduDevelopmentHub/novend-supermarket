"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { recoverStaleClient } from "@/lib/auth/recover-auth-navigation";
import {
  isConnectivityError,
  isServiceWorkerRegistrationError,
  isStaleClientError,
} from "@/lib/errors";

const STALE_TOAST_ID = "stale-client";
const FRIENDLY_STALE =
  "Novend needs a quick refresh to load the latest version. Your saved work is safe on this device.";

function combinedToastText(message: unknown, data?: { description?: unknown }) {
  const description =
    data && typeof data === "object" && "description" in data ? data.description : undefined;
  return `${String(message ?? "")} ${String(description ?? "")}`;
}

/**
 * Catch browser rejections that must not become Sentry noise or raw toasts:
 *
 * 1. Convex Auth `invalidateCache` Server Action id after a deploy (stale client).
 * 2. `TypeError: Failed to fetch` from Next prefetch / flaky Electron radio.
 * 3. `SecurityError: Script …/sw.js load failed` — Chrome-on-iOS / private mode
 *    refusing the service worker (not an app security bug).
 */
export function StaleClientRecovery() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isStaleClientError(event.reason)) {
        event.preventDefault();
        toast.dismiss();
        recoverStaleClient(event.reason);
        return;
      }
      if (isServiceWorkerRegistrationError(event.reason) || isConnectivityError(event.reason)) {
        event.preventDefault();
      }
    };

    const onWindowError = (event: ErrorEvent) => {
      const payload = event.error ?? event.message;
      if (isStaleClientError(payload)) {
        event.preventDefault();
        toast.dismiss();
        recoverStaleClient(payload);
        return;
      }
      if (isServiceWorkerRegistrationError(payload) || isConnectivityError(payload)) {
        event.preventDefault();
      }
    };

    const originalError = toast.error.bind(toast);
    toast.error = ((message: unknown, data?: Parameters<typeof toast.error>[1]) => {
      const combined = combinedToastText(
        message,
        data as { description?: unknown } | undefined,
      );
      if (isStaleClientError(message) || isStaleClientError(combined)) {
        recoverStaleClient(combined);
        return originalError(FRIENDLY_STALE, { id: STALE_TOAST_ID, duration: 6_000 });
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
    window.addEventListener("error", onWindowError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onWindowError);
      observer.disconnect();
      toast.error = originalError;
    };
  }, []);
  return null;
}
