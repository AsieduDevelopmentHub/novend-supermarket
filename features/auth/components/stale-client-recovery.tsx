"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { recoverStaleClient } from "@/lib/auth/recover-auth-navigation";
import { isStaleClientError } from "@/lib/errors";

const STALE_TOAST_ID = "stale-client";

/**
 * Convex Auth calls a Next Server Action (`invalidateCache`) on every sign-in.
 * After a deploy, Electron/Cap/SW clients often still hold the previous action
 * id. Next then rejects with “Server Action … was not found”, which used to
 * fail password login and paint the raw hex id in a toast.
 *
 * Catch that rejection, rewrite any Sonner toast that leaks the id, and reload
 * once so the open page matches the server.
 */
export function StaleClientRecovery() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isStaleClientError(event.reason)) return;
      event.preventDefault();
      toast.dismiss(STALE_TOAST_ID);
      recoverStaleClient(event.reason);
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
