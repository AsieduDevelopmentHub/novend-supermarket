"use client";

import { useEffect, useState } from "react";
import { isConnectivityError, toUserMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import {
  isChunkLoadError,
  isReactDomDetachError,
  recoverToLoginAfterFailure,
  shouldRecoverToLogin,
} from "@/lib/auth/recover-auth-navigation";
import { resumeOfflineShellToDashboard } from "@/lib/auth/awaiting-cloud-reconnect";
import { hasOfflineSession } from "@/lib/offline/session";

/**
 * Root error boundary — branded Novend UI instead of a blank host error sheet.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [recovering, setRecovering] = useState(false);
  const offline = isConnectivityError(error);
  const chunkMiss = isChunkLoadError(error);
  const recoverLogin = shouldRecoverToLogin(error);
  const hasShell = typeof window !== "undefined" && hasOfflineSession();

  useEffect(() => {
    if (!recoverLogin || recovering) return;
    setRecovering(true);
    void recoverToLoginAfterFailure();
  }, [recoverLogin, recovering]);

  useEffect(() => {
    if (!isReactDomDetachError(error) || recovering) return;
    reset();
  }, [error, recovering, reset]);

  if (recovering || recoverLogin) {
    return (
      <html lang="en">
        <body className="bg-background text-foreground antialiased">
          <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
            <h1 className="text-xl font-semibold">Opening sign-in…</h1>
            <p className="text-muted-foreground max-w-md text-sm">
              Taking you to the login screen so another cashier can sign in on this till.
            </p>
          </div>
        </body>
      </html>
    );
  }

  const title = offline ? "You're working offline" : "Something went wrong";
  const message = toUserMessage(
    error,
    offline
      ? "Novend will keep using data saved on this device when the connection returns."
      : chunkMiss
        ? "This screen could not load while offline. Open sign-in or reconnect and try again."
        : "We hit an unexpected problem. You can try again or go back to the dashboard.",
  );

  function retry() {
    if (hasShell) {
      resumeOfflineShellToDashboard(reset);
      return;
    }
    reset();
  }

  function goDashboard() {
    if (hasShell) {
      resumeOfflineShellToDashboard(reset);
      return;
    }
    window.location.assign("/dashboard");
  }

  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-muted-foreground max-w-md text-sm">{message}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={retry}>
              {offline ? "Continue" : "Try again"}
            </Button>
            {chunkMiss && !hasShell ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRecovering(true);
                  void recoverToLoginAfterFailure();
                }}
              >
                Open sign-in
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={goDashboard}>
                Go to dashboard
              </Button>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
