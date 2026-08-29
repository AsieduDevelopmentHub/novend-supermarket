"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/constants/app";
import { BRANDING } from "@/constants/branding";
import { ROUTES } from "@/config/navigation";
import { showError } from "@/lib/errors";
import Image from "next/image";

export function ForgotPasswordForm() {
  const requestReset = useAction(api.passwordReset.requestPasswordReset);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await requestReset({ email: email.trim().toLowerCase() });
      setSent(true);
      toast.success(result.message);
    } catch (error) {
      showError(error, "Could not send a reset email right now.");
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
            Reset your password
          </h1>
          <p className="text-muted-foreground text-sm">{APP_NAME}</p>
        </div>
      </div>

      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground text-sm">
            If that email has a Novend account, we sent a reset link. Check your inbox and spam
            folder.
          </p>
          <Button asChild className="h-11 w-full">
            <Link href={ROUTES.login}>Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                autoComplete="email"
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
          </div>
          <Button type="submit" className="h-11 w-full text-[15px] font-semibold" disabled={pending}>
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
