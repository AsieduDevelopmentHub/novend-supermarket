"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isConnectivityError, toUserMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import {
  isChunkLoadError,
  recoverToLoginAfterFailure,
  shouldRecoverToLogin,
} from "@/lib/auth/recover-auth-navigation";

export default function AppError({
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

  useEffect(() => {
    if (!recoverLogin || recovering) return;
    setRecovering(true);
    void recoverToLoginAfterFailure();
  }, [recoverLogin, recovering]);

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

  const title = offline ? "You're working offline" : "Something went wrong";
  const message = toUserMessage(
    error,
    offline
      ? "This screen will keep using the data saved on this device. Sales and stock still work."
      : chunkMiss
        ? "This screen could not load while offline. Open sign-in or reconnect and try again."
        : "We hit an unexpected problem. Please try again.",
  );

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm">{message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={reset}>
          {offline ? "Continue" : "Try again"}
        </Button>
        {chunkMiss || offline ? (
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
          <Button asChild type="button" variant="outline">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
