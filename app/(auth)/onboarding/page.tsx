import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Account not assigned</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Novend no longer accepts public business signup. A platform administrator creates your
          organization, then your admin creates staff logins.
        </p>
        <Button asChild>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    </div>
  );
}
