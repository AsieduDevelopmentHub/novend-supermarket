"use client";

import { useEffect, useState } from "react";
import { isConnectivityError, toUserMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import {
  isChunkLoadError,
  isReactDomDetachError,
  recoverFromChunkLoadFailure,
  recoverToLoginAfterFailure,
  shouldAutoRecoverChunkFailure,
  shouldRecoverToLogin,
} from "@/lib/auth/recover-auth-navigation";
import { resumeOfflineShellToDashboard } from "@/lib/auth/awaiting-cloud-reconnect";

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
  const [refreshingClient, setRefreshingClient] = useState(false);
  const offline = isConnectivityError(error);
  const chunkMiss = isChunkLoadError(error);
  const recoverLogin = shouldRecoverToLogin(error);

  useEffect(() => {
    if (!recoverLogin || recovering) return;
    setRecovering(true);
    void recoverToLoginAfterFailure();
  }, [recoverLogin, recovering]);

  useEffect(() => {
    if (!chunkMiss || recoverLogin || recovering || refreshingClient) return;
    if (!shouldAutoRecoverChunkFailure(error)) return;
    setRefreshingClient(true);
    recoverFromChunkLoadFailure();
  }, [chunkMiss, error, recoverLogin, recovering, refreshingClient, reset]);

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

  if (refreshingClient) {
    return (
      <html lang="en">
        <body className="bg-background text-foreground antialiased">
          <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
            <h1 className="text-xl font-semibold">Refreshing Novend…</h1>
            <p className="text-muted-foreground max-w-md text-sm">
              Loading the latest version. Your saved work is safe.
            </p>
          </div>
        </body>
      </html>
    );
  }

  const title = chunkMiss
    ? "Novend needs a refresh"
    : offline
      ? "You're working offline"
      : "Something went wrong";
  const message = chunkMiss
    ? "Refresh Novend to load the latest version. Your saved work is safe on this device."
    : toUserMessage(
        error,
        offline
          ? "Novend will keep using data saved on this device when the connection returns."
          : "We hit an unexpected problem. You can try again or go back to the dashboard.",
      );

  function retry() {
    if (chunkMiss || isChunkLoadError(error)) {
      setRefreshingClient(true);
      recoverFromChunkLoadFailure();
      return;
    }
    // Always hard-navigate — reset() alone re-throws on poisoned /platform trees.
    resumeOfflineShellToDashboard(reset);
  }

  function goDashboard() {
    if (chunkMiss || isChunkLoadError(error)) {
      setRefreshingClient(true);
      recoverFromChunkLoadFailure();
      return;
    }
    resumeOfflineShellToDashboard(reset);
  }

  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-muted-foreground max-w-md text-sm">{message}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={retry}>
              {chunkMiss ? "Refresh Novend" : offline ? "Continue" : "Try again"}
            </Button>
            {chunkMiss ? null : (
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
