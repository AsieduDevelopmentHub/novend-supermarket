"use client";

import { useEffect, useState } from "react";
import { isConnectivityError, isStaleClientError, toUserMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import {
  isChunkLoadError,
  isReactDomDetachError,
  recoverFromChunkLoadFailure,
  recoverToLoginAfterFailure,
  shouldAutoRecoverChunkFailure,
  shouldAutoRecoverStaleClient,
  shouldRecoverToLogin,
} from "@/lib/auth/recover-auth-navigation";
import { resumeOfflineShellToDashboard } from "@/lib/auth/awaiting-cloud-reconnect";

export default function AppError({
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
  const staleClient = isStaleClientError(error);
  const refreshClient = chunkMiss || staleClient;
  const recoverLogin = shouldRecoverToLogin(error);

  useEffect(() => {
    if (!recoverLogin || recovering) return;
    setRecovering(true);
    void recoverToLoginAfterFailure();
  }, [recoverLogin, recovering]);

  useEffect(() => {
    if (!refreshClient || recoverLogin || recovering || refreshingClient) return;
    const claimed = chunkMiss
      ? shouldAutoRecoverChunkFailure(error)
      : shouldAutoRecoverStaleClient(error);
    if (!claimed) return;
    setRefreshingClient(true);
    recoverFromChunkLoadFailure();
  }, [chunkMiss, error, recoverLogin, recovering, refreshClient, refreshingClient, reset]);

  // Hard-nav leave-site cleanup used to detach forms React still owned; that
  // throws removeChild and paints this sheet after Welcome. Soft-recover.
  useEffect(() => {
    if (!isReactDomDetachError(error) || recovering) return;
    reset();
  }, [error, recovering, reset]);

  if (recovering || recoverLogin) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <h2 className="text-lg font-semibold">Opening sign-in…</h2>
        <p className="text-muted-foreground max-w-md text-sm">
          Taking you to the login screen so another cashier can sign in on this till.
        </p>
      </div>
    );
  }

  if (refreshingClient) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <h2 className="text-lg font-semibold">Refreshing Novend…</h2>
        <p className="text-muted-foreground max-w-md text-sm">
          Loading the latest version. Your saved work is safe.
        </p>
      </div>
    );
  }

  const title = refreshClient
    ? "Novend needs a refresh"
    : offline
      ? "You're working offline"
      : "Something went wrong";
  const message = refreshClient
    ? "Refresh Novend to load the latest version. Your saved work is safe on this device."
    : toUserMessage(
        error,
        offline
          ? "This screen will keep using the data saved on this device. Sales and stock still work."
          : "We hit an unexpected problem. Please try again.",
      );

  function retry() {
    // Always hard-refresh chunk/module-factory failures — soft reset re-throws
    // immediately and looks like dead Try again / Go to dashboard buttons.
    if (refreshClient || isChunkLoadError(error) || isStaleClientError(error)) {
      setRefreshingClient(true);
      recoverFromChunkLoadFailure();
      return;
    }
    resumeOfflineShellToDashboard(reset);
  }

  function goDashboard() {
    if (refreshClient || isChunkLoadError(error) || isStaleClientError(error)) {
      setRefreshingClient(true);
      recoverFromChunkLoadFailure();
      return;
    }
    resumeOfflineShellToDashboard(reset);
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm">{message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={retry}>
          {refreshClient ? "Refresh Novend" : offline ? "Continue" : "Try again"}
        </Button>
        {refreshClient ? null : (
          <Button type="button" variant="outline" onClick={goDashboard}>
            Go to dashboard
          </Button>
        )}
      </div>
    </div>
  );
}
