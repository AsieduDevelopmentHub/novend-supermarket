"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { VerifyEmailDialog } from "@/features/auth/components/verify-email-dialog";
import { useConnectivity } from "@/hooks/use-connectivity";
import { shouldShowEmailVerificationReminder } from "@/convex/shared/emailOtp";

const DISMISS_KEY = "novend.emailVerify.dismissed";

export function EmailVerificationBanner() {
  const { isAuthenticated } = useConvexAuth();
  const online = useConnectivity();
  const me = useQuery(api.users.me, isAuthenticated && online ? {} : "skip");
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === "1");
      } catch {
        setDismissed(false);
      }
    });
  }, []);

  const visible = shouldShowEmailVerificationReminder({
    online,
    emailVerified: me?.emailVerified,
    dismissed,
  });

  if (!visible && !open) return null;

  return (
    <>
      {visible ? (
        <div
          role="status"
          className="border-primary/20 bg-primary/10 text-foreground flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-xs sm:gap-3 sm:px-4 sm:py-2 sm:text-sm lg:px-8"
        >
          <Mail className="text-primary h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
          <span className="min-w-0 flex-1 truncate">Verify your email to secure your account.</span>
          <Button size="sm" className="h-7 shrink-0 px-2.5 text-xs" onClick={() => setOpen(true)}>
            Verify email
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() => {
              setDismissed(true);
              try {
                window.sessionStorage.setItem(DISMISS_KEY, "1");
              } catch {
                /* private mode */
              }
            }}
          >
            Later
          </Button>
        </div>
      ) : null}
      <VerifyEmailDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
