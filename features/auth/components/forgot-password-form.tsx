"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { Mail } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/constants/app";
import { BRANDING } from "@/constants/branding";
import { ROUTES } from "@/config/navigation";
import { PASSWORD_RESET_MIN_INTERVAL_MS } from "@/convex/shared/passwordResetCrypto";
import { showError } from "@/lib/errors";
import Image from "next/image";

export function ForgotPasswordForm() {
  const requestReset = useAction(api.passwordReset.requestPasswordReset);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendInMs, setResendInMs] = useState(0);

  useEffect(() => {
    if (resendInMs <= 0) return;
    const timer = window.setInterval(() => {
      setResendInMs((current) => Math.max(0, current - 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendInMs]);

  async function sendLink(address: string) {
    setPending(true);
    try {
      await requestReset({ email: address });
      setSentTo(address);
      setResendInMs(PASSWORD_RESET_MIN_INTERVAL_MS);
    } catch (error) {
      showError(error, "Could not send a reset email right now.");
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await sendLink(email.trim().toLowerCase());
  }

  const resendSeconds = Math.ceil(resendInMs / 1000);

  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div className="mb-8 space-y-4 text-center">
        <div className="relative mx-auto h-16 w-16">
          <Image
            src={BRANDING.brandmark}
            alt=""
            fill
            priority
            unoptimized
            sizes="64px"
            className="object-contain"
          />
        </div>
        <div className="space-y-1">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {sentTo ? "Check your email" : "Forgot your password?"}
          </h1>
          <p className="text-muted-foreground text-sm">{APP_NAME}</p>
        </div>
      </div>

      {sentTo ? (
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground text-sm leading-relaxed">
            If <span className="text-foreground font-medium">{sentTo}</span> has a Novend account,
            we sent a reset link. It expires in one hour and can be used once.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Check your inbox and spam folder. The email is from Novend.
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled={pending || resendInMs > 0}
            onClick={() => void sendLink(sentTo)}
          >
            {pending ? "Sending…" : resendInMs > 0 ? `Resend in ${resendSeconds}s` : "Resend email"}
          </Button>
          <Button asChild className="h-11 w-full">
            <Link href={ROUTES.login}>Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@business.com"
                className="bg-muted/50 h-11 pr-10"
                required
              />
              <Mail
                className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
                aria-hidden
              />
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              We&apos;ll email a one-hour reset link if this address has an account. For privacy, we
              won&apos;t say whether it exists.
            </p>
          </div>
          <Button
            type="submit"
            className="h-11 w-full text-[15px] font-semibold"
            disabled={pending}
          >
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Remembered it?{" "}
        <Link href={ROUTES.login} className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
