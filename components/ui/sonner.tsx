"use client";

import type { MouseEvent } from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

/**
 * App-wide notifications.
 *
 * Top-right is the global default. An X dismisses on desktop; swipe still
 * works on mobile. Repeating toasts should pass a stable `id` so they replace
 * instead of stacking. Clicking a toast dismisses it.
 */
export function Toaster() {
  return (
    <div onClick={onToastClick}>
      <SonnerToaster
        closeButton
        richColors
        position="top-right"
        visibleToasts={3}
        duration={4000}
        gap={8}
        offset={16}
        mobileOffset={{
          top: "calc(4.5rem + env(safe-area-inset-top, 0px))",
          right: "0.75rem",
        }}
        toastOptions={{
          closeButton: true,
          classNames: {
            toast: "cursor-pointer",
            closeButton:
              "bg-background! border-border! text-foreground! opacity-100! left-auto! right-0! translate-x-1/3! -translate-y-1/3!",
          },
        }}
      />
    </div>
  );
}

function onToastClick(event: MouseEvent<HTMLDivElement>) {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  if (target.closest("[data-close-button], [data-button], a, button")) return;
  if (!target.closest("[data-sonner-toast]")) return;
  toast.dismiss();
}
