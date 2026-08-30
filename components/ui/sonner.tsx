"use client";

import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import { X } from "lucide-react";
import { Toaster as SonnerToaster, toast } from "sonner";

const toasterStyle = {
  "--toast-close-button-start": "auto",
  "--toast-close-button-end": "0.5rem",
  "--toast-close-button-transform": "none",
} as CSSProperties;

/**
 * App-wide notifications.
 *
 * Top-right on desktop, top of the viewport on mobile. The close icon sits
 * inside the toast. Swipe still dismisses on touch. Repeating toasts should
 * pass a stable `id` so they replace instead of stacking. Clicking a toast
 * dismisses it.
 */
export function Toaster() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;

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
          top: "max(16px, env(safe-area-inset-top, 0px))",
          right: 16,
          left: 16,
        }}
        icons={{
          close: <X className="size-5" strokeWidth={2.25} aria-hidden />,
        }}
        style={toasterStyle}
        toastOptions={{
          closeButton: true,
          classNames: {
            toast: "cursor-pointer",
            closeButton:
              "static! order-last! top-auto! left-auto! size-5! shrink-0! rounded-md! border-0! bg-transparent! shadow-none! text-current! opacity-100 hover:bg-foreground/10!",
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
