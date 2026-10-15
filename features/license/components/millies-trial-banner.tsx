"use client";

import Link from "next/link";
import { useMilliesLicense } from "@/providers/millies-license-provider";
import { usePermissions } from "@/hooks/use-permissions";
import { replaceClientShellUrl } from "@/lib/navigation/client-shell-url";
import { useRouter } from "next/navigation";

/** Compact reminder during trial — activate anytime from Settings → License. */
export function MilliesTrialBanner() {
  const { status } = useMilliesLicense();
  const { isAdmin } = usePermissions();
  const router = useRouter();

  if (!status || status.mode !== "trial" || !isAdmin) return null;

  function openLicense() {
    const href = "/settings?section=license";
    if (replaceClientShellUrl(href)) return;
    router.push(href);
  }

  return (
    <div className="border-border bg-muted/60 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-sm md:px-4">
      <p className="text-muted-foreground min-w-0">
        Trial · {status.trialDaysRemaining} day{status.trialDaysRemaining === 1 ? "" : "s"} left.
        You can activate a license key anytime — no need to wait.
      </p>
      <button
        type="button"
        onClick={openLicense}
        className="text-primary shrink-0 font-medium underline-offset-2 hover:underline"
      >
        Activate license
      </button>
      <Link href="/settings?section=license" className="sr-only">
        Activate license
      </Link>
    </div>
  );
}
