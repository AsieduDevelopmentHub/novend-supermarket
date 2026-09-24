"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/constants/app";
import { BRANDING } from "@/constants/branding";
import { ROUTES } from "@/config/navigation";
import { usePublicSiteHref } from "@/features/auth/components/public-site-host";
import { PASSWORD_MIN_LENGTH, passwordMeetsPolicy } from "@/convex/shared/passwordPolicy";
import { PasswordStrengthMeter } from "@/features/auth/components/password-strength";
import { showError } from "@/lib/errors";
import Image from "next/image";

export function ResetPasswordForm() {
  return (
    <Suspense>
      <ResetPasswordFormInner />
    </Suspense>
  );
}

function ResetPasswordFormInner() {
  const signInHref = usePublicSiteHref(ROUTES.login);
  const completeReset = useAction(api.passwordReset.completePasswordReset);
  const token = useSearchParams().get("token")?.trim() ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const validToken = /^[a-f0-9]{64}$/i.test(token);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validToken) return;
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    if (!passwordMeetsPolicy(password)) return;
    setPending(true);
    try {
      await completeReset({ token, newPassword: password });
      setUpdated(true);
    } catch (error) {
      showError(error, "This reset link is invalid or has expired.");
    } finally {
      setPending(false);
    }
  }

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
            {updated ? "Password updated" : "Choose a new password"}
          </h1>
          <p className="text-muted-foreground text-sm">{APP_NAME}</p>
        </div>
      </div>

      {updated ? (
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Sign in with your new password. Other devices were signed out. We also sent a
            confirmation to your email.
          </p>
          <Button asChild className="h-11 w-full">
            <Link href={signInHref}>Sign in</Link>
          </Button>
        </div>
      ) : !validToken ? (
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground text-sm leading-relaxed">
            This reset link is invalid or has expired. Request a new one — links last one hour and
            work only once.
          </p>
          <Button asChild className="h-11 w-full">
            <Link href={ROUTES.forgotPassword}>Request a new link</Link>
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="bg-muted/50 h-11"
              required
              minLength={PASSWORD_MIN_LENGTH}
            />
            <PasswordStrengthMeter password={password} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => {
                setConfirm(event.target.value);
                setMismatch(false);
              }}
              className="bg-muted/50 h-11"
              required
              minLength={PASSWORD_MIN_LENGTH}
            />
            {mismatch ? (
              <p className="text-destructive text-xs" role="alert">
                Passwords do not match.
              </p>
            ) : null}
          </div>
          <Button
            type="submit"
            className="h-11 w-full text-[15px] font-semibold"
            disabled={pending || !passwordMeetsPolicy(password)}
          >
            {pending ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </div>
  );
}
