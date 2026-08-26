import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Full-page access denied — used when middleware or a deep link rejects a role.
 * Never surface a blank Chromium/Vercel error sheet for permission failures.
 */
export default function UnauthorizedPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
        <ShieldOff className="text-muted-foreground h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">You don’t have access</h1>
        <p className="text-muted-foreground mx-auto max-w-md text-sm leading-relaxed">
          This area isn’t available for your role. Ask an administrator if you need permission, or
          continue with your usual Novend screens.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/sales">Open sales</Link>
        </Button>
      </div>
    </div>
  );
}
