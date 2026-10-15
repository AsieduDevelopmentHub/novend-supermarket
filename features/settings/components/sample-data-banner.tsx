"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import { getMilliesSampleDataStatus } from "@/lib/offline/millies-auth-db";
import { readMilliesSession } from "@/lib/offline/millies-auth";
import { cn } from "@/lib/utils";

/** Banner while Millie's sample catalogue is active. */
export function SampleDataBanner() {
  const [active, setActive] = useState(false);
  const session = readMilliesSession();

  useEffect(() => {
    void getMilliesSampleDataStatus().then((status) => setActive(status === "active"));
  }, []);

  if (!active) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-primary/25 bg-primary/8 px-3 py-1.5 text-xs text-foreground sm:gap-3 sm:px-4 sm:py-2 sm:text-sm lg:px-8",
      )}
    >
      <Rocket className="text-primary h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
      <span className="min-w-0 flex-1">
        You’re exploring with sample data. When you’re ready for real stock, go live.
      </span>
      {session?.role === "administrator" ? (
        <Link
          href="/settings?section=business"
          className="text-primary shrink-0 text-xs font-medium underline sm:text-sm"
        >
          Go live
        </Link>
      ) : null}
    </div>
  );
}
