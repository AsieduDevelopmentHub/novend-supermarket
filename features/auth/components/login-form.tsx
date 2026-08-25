"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SERVER_UNREACHABLE_MESSAGE, showError } from "@/lib/errors";
import Image from "next/image";
import { Mail } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { APP_NAME } from "@/constants/app";
import { BRANDING } from "@/constants/branding";
import { LoadingState } from "@/components/feedback/loading-state";
import { cn } from "@/lib/utils";
import { navigateAfterLogin, resolvePostLoginPath } from "@/lib/auth/redirect-after-login";

const REMEMBER_KEY = "novend.login.rememberEmail";

export function LoginForm({ compact = false }: { compact?: boolean }) {
  const configured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  if (!configured) {
    return (
      <div className="w-full max-w-sm space-y-3 text-center">
        <h1 className="text-xl font-semibold">Service not ready</h1>
        <p className="text-muted-foreground text-sm">
          Novend isn&apos;t connected to its cloud service yet. Ask your administrator to finish
          setup, then refresh this page.
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingState label="Loading…" variant="form" />}>
      <ConfiguredLoginForm compact={compact} />
    </Suspense>
  );
}

function ConfiguredLoginForm({ compact }: { compact: boolean }) {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const convex = useConvex();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnNext = searchParams.get("next");
  const redirectingRef = useRef(false);
  const registration = useQuery(api.users.registrationStatus);
  const recordLoginFailure = useMutation(api.loginGuards.recordLoginFailure);
  const clearLoginFailures = useMutation(api.loginGuards.clearLoginFailures);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [pending, setPending] = useState(false);
  const [openingWorkspace, setOpeningWorkspace] = useState(false);

  const isProvisioned = registration?.hasUsers === true;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(REMEMBER_KEY);
        if (saved) {
          setEmail(saved);
          setRememberMe(true);
        }
      } catch {
        /* ignore storage errors */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Already signed in (e.g. opened /login with a live session) — leave auth pages.
  useEffect(() => {
    if (!isAuthenticated || authLoading || redirectingRef.current || pending) return;
    redirectingRef.current = true;
    setOpeningWorkspace(true);
    void (async () => {
      const path = await resolvePostLoginPath(convex, returnNext);
      navigateAfterLogin(path, router);
    })();
  }, [isAuthenticated, authLoading, convex, returnNext, router, pending]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isProvisioned || pending || redirectingRef.current) {
      if (!isProvisioned) toast.error("This business isn't set up yet. Contact Novend support.");
      return;
    }

    setPending(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      await convex.query(api.loginGuards.assertLoginAllowed, { email: normalizedEmail });

      try {
        if (rememberMe) {
          window.localStorage.setItem(REMEMBER_KEY, normalizedEmail);
        } else {
          window.localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        /* ignore storage errors */
      }

      const formData = new FormData();
      formData.set("email", normalizedEmail);
      formData.set("password", password);
      formData.set("flow", "signIn");
      await signIn("password", formData);
      try {
        await clearLoginFailures({});
      } catch {
        /* non-fatal */
      }
      toast.success("Welcome");

      // Navigate from the submit path — do not wait for reactive `me` (that left
      // /login blank until reload). resolvePostLoginPath retries while the token settles.
      redirectingRef.current = true;
      setOpeningWorkspace(true);
      const path = await resolvePostLoginPath(convex, returnNext);
      navigateAfterLogin(path, router);
    } catch (error) {
      redirectingRef.current = false;
      setOpeningWorkspace(false);
      const raw = error instanceof Error ? error.message : "";
      if (raw.toLowerCase().includes("auth provider discovery")) {
        showError(error, SERVER_UNREACHABLE_MESSAGE);
      } else if (raw.toLowerCase().includes("too many failed")) {
        showError(error, "Too many failed sign-in attempts.");
      } else {
        try {
          await recordLoginFailure({ email: normalizedEmail });
        } catch (lockError) {
          const lockMsg = lockError instanceof Error ? lockError.message : "";
          if (lockMsg.toLowerCase().includes("too many failed")) {
            showError(lockError, "Too many failed sign-in attempts.");
            setPending(false);
            return;
          }
        }
        showError(error, "Sign in failed. Check your email and password.");
      }
      setPending(false);
    }
  }

  if (registration === undefined) {
    return (
      <div className="w-full max-w-[360px] py-10">
        <LoadingState label="Loading…" variant="form" />
      </div>
    );
  }

  if (!isProvisioned) {
    return (
      <div className="mx-auto w-full max-w-[360px]">
        <div className={cn("text-center", compact ? "mb-6 space-y-1" : "mb-8 space-y-1")}>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            System not provisioned
          </h1>
          <p className="text-muted-foreground text-sm">{APP_NAME}</p>
        </div>
        <p className="bg-muted text-muted-foreground rounded-lg px-3 py-3 text-left text-sm leading-relaxed">
          No administrator exists yet. Ask the system owner to finish setup, then try again.
        </p>
      </div>
    );
  }

  if (openingWorkspace) {
    return (
      <div className="mx-auto w-full max-w-[360px] py-10">
        <LoadingState label="Opening workspace…" variant="form" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[360px]">
      <FormHeader compact={compact} />

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-muted/50 h-11"
            required
            minLength={8}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 pt-0.5 text-sm">
          <Checkbox
            checked={rememberMe}
            onCheckedChange={(value) => setRememberMe(value === true)}
            aria-label="Remember me"
          />
          <span className="text-foreground/90">Remember me</span>
        </label>

        <Button type="submit" className="h-11 w-full text-[15px] font-semibold" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        New business?{" "}
        <Link href="/signup" className="text-primary font-medium hover:underline">
          Start a 14-day free trial
        </Link>
      </p>
      <p className="text-muted-foreground mt-3 text-center text-xs leading-relaxed">
        Staff accounts are created by your administrator.
      </p>
    </div>
  );
}

function FormHeader({ compact }: { compact: boolean }) {
  return (
    <div className={cn("text-center", compact ? "mb-6 space-y-3" : "mb-8 space-y-4")}>
      <div className={cn("relative mx-auto", compact ? "h-14 w-14" : "h-16 w-16")}>
        <Image
          src={BRANDING.brandmark}
          alt=""
          fill
          priority
          sizes="64px"
          className="object-contain"
        />
      </div>
      <div className="space-y-1">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">{APP_NAME}</p>
      </div>
    </div>
  );
}
