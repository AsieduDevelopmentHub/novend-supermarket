"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useConvexAuth } from "convex/react";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SERVER_UNREACHABLE_MESSAGE, showError } from "@/lib/errors";
import Image from "next/image";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { APP_NAME } from "@/constants/app";
import { BRANDING } from "@/constants/branding";
import { ROUTES } from "@/config/navigation";
import { LoadingState } from "@/components/feedback/loading-state";
import { cn } from "@/lib/utils";
import { isCapacitor } from "@novend/hardware";
import { navigateAfterLogin, resolvePostLoginPath } from "@/lib/auth/redirect-after-login";
import { consumeExplicitLogout, hasExplicitLogout } from "@/lib/auth/logout-flag";
import { useConnectivity } from "@/hooks/use-connectivity";
import { hasOfflineSession } from "@/lib/offline/session";
import { resolvePostAuthPath } from "@/lib/auth/safe-return-path";

const REMEMBER_KEY = "novend.login.rememberEmail";
const LOGIN_DEVICE_KEY = "novend.login.deviceKey";
let volatileLoginDeviceKey: string | null = null;

function getLoginDeviceKey(): string {
  if (volatileLoginDeviceKey) return volatileLoginDeviceKey;
  try {
    const stored = window.localStorage.getItem(LOGIN_DEVICE_KEY);
    if (stored) {
      volatileLoginDeviceKey = stored;
      return stored;
    }
    const created = crypto.randomUUID();
    window.localStorage.setItem(LOGIN_DEVICE_KEY, created);
    volatileLoginDeviceKey = created;
    return created;
  } catch {
    volatileLoginDeviceKey = crypto.randomUUID();
    return volatileLoginDeviceKey;
  }
}

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
  const online = useConnectivity();
  const convex = useConvex();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromBoot = searchParams.get("fromBoot") === "1";
  const signedOut = searchParams.get("signedOut") === "1" || hasExplicitLogout();
  const redirectingRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [pending, setPending] = useState(false);
  const [openingWorkspace, setOpeningWorkspace] = useState(false);

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

  function withBootMarker(path: string): string {
    if (!fromBoot || path.includes("fromBoot=")) return path;
    return `${path}${path.includes("?") ? "&" : "?"}fromBoot=1`;
  }

  // Cached session: leave /login immediately (no waiting on Convex / brand chrome).
  // After an explicit logout, never resume the previous user's Dexie/localStorage session.
  useEffect(() => {
    if (redirectingRef.current || pending || isAuthenticated) return;
    if (signedOut) return;
    if (!hasOfflineSession()) return;

    const shouldResumeNow = !online || fromBoot || isCapacitor();
    if (!shouldResumeNow) return;
    // Online Cap without fromBoot: give live auth a brief head start, then resume.
    if (online && !fromBoot && authLoading) {
      const timer = window.setTimeout(() => {
        if (redirectingRef.current || isAuthenticated) return;
        redirectingRef.current = true;
        setOpeningWorkspace(true);
        navigateAfterLogin(
          withBootMarker(
            resolvePostAuthPath({
              isPlatformAdmin: false,
              needsOnboarding: false,
              needsProfile: false,
            }),
          ),
          router,
        );
      }, 800);
      return () => window.clearTimeout(timer);
    }

    redirectingRef.current = true;
    queueMicrotask(() => {
      setOpeningWorkspace(true);
      navigateAfterLogin(
        withBootMarker(
          resolvePostAuthPath({
            isPlatformAdmin: false,
            needsOnboarding: false,
            needsProfile: false,
          }),
        ),
        router,
      );
    });
  }, [online, fromBoot, isAuthenticated, authLoading, pending, router, signedOut]);

  // Already signed in without submitting credentials.
  // Keep fromBoot so cold start can restore the last in-app route after shell mount.
  // After logout, stay on the form even if the previous cookie has not dropped yet.
  useEffect(() => {
    if (signedOut) return;
    if (!isAuthenticated || authLoading || redirectingRef.current || pending) return;
    redirectingRef.current = true;
    queueMicrotask(() => {
      setOpeningWorkspace(true);
      void (async () => {
        const path = await resolvePostLoginPath(convex);
        navigateAfterLogin(withBootMarker(path), router);
      })();
    });
  }, [isAuthenticated, authLoading, convex, router, pending, fromBoot, signedOut]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || redirectingRef.current) {
      return;
    }

    setPending(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
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
      formData.set("deviceKey", getLoginDeviceKey());
      await signIn("password", formData);
      consumeExplicitLogout();
      toast.success("Welcome");

      // Fresh password sign-in: always Dashboard (ignore last route / fromBoot).
      redirectingRef.current = true;
      setOpeningWorkspace(true);
      const path = await resolvePostLoginPath(convex);
      navigateAfterLogin(path, router);
    } catch (error) {
      redirectingRef.current = false;
      setOpeningWorkspace(false);
      const raw = error instanceof Error ? error.message : "";
      const lower = raw.toLowerCase();
      if (lower.includes("auth provider discovery")) {
        showError(error, SERVER_UNREACHABLE_MESSAGE);
      } else {
        showError(error, "Sign in failed. Check your email and password.");
      }
      setPending(false);
    }
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
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to website
      </Link>

      <FormHeader compact={compact} />

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            <Link
              href={ROUTES.forgotPassword}
              className="text-primary text-sm font-medium hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-muted/50 h-11"
            required
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

        <Button
          type="submit"
          className="h-11 w-full text-[15px] font-semibold"
          disabled={pending}
          aria-busy={pending}
        >
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
          unoptimized
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
