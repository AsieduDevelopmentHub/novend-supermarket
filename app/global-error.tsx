"use client";

import { isConnectivityError, toUserMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
  const offline = isConnectivityError(error);
  const title = offline ? "You're working offline" : "Something went wrong";
  const message = toUserMessage(
    error,
    offline
      ? "Novend will keep using data saved on this device when the connection returns."
      : "We hit an unexpected problem. You can try again or go back to the dashboard.",
  );

  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-muted-foreground max-w-md text-sm">{message}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={reset}>
              {offline ? "Continue" : "Try again"}
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
