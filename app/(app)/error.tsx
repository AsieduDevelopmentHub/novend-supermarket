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
import { hasOfflineSession } from "@/lib/offline/session";

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
  const recoverLogin = shouldRecoverToLogin(error);
  const hasShell = typeof window !== "undefined" && hasOfflineSession();

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
          ? "This screen will keep using the data saved on this device. Sales and stock still work."
          : "We hit an unexpected problem. Please try again.",
      );

  function retry() {
    if (chunkMiss) {
      setRefreshingClient(true);
      recoverFromChunkLoadFailure();
      return;
    }
    if (hasShell) {
      resumeOfflineShellToDashboard(reset);
      return;
    }
    reset();
  }

  function goDashboard() {
    // Soft client recover — Next Link to the dashboard route hits middleware
    // without a Convex JWT and redirects Cap/Electron reconnect shells to login.
    if (hasShell) {
      resumeOfflineShellToDashboard(reset);
      return;
    }
    window.location.assign("/dashboard");
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
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
  );
}
