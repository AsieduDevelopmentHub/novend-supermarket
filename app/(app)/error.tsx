"use client";

import { toUserMessage } from "@/lib/errors";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = toUserMessage(error, "We hit an unexpected problem. Please try again.");

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground max-w-md text-sm">{message}</p>
      <button
        type="button"
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
        onClick={reset}
      >
        Try again
      </button>
    </div>
  );
}
