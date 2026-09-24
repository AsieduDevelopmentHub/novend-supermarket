"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useConvexAuth } from "convex/react";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SERVER_UNREACHABLE_MESSAGE, showError } from "@/lib/errors";
import Image from "next/image";
import { ArrowLeft, Mail, Users } from "lucide-react";
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
import { navigateAfterLogin, resolvePostLoginPath } from "@/lib/auth/redirect-after-login";
import { consumeExplicitLogout, hasExplicitLogout } from "@/lib/auth/logout-flag";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  activateOfflineSession,
  clearOfflineSession,
  hasOfflineSession,
  listOfflineSessions,
  type OfflineSessionHint,
} from "@/lib/offline/session";
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
  const [cachedAccounts, setCachedAccounts] = useState<OfflineSessionHint[]>([]);

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
      setCachedAccounts(listOfflineSessions());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function withBootMarker(path: string): string {
    if (!fromBoot || path.includes("fromBoot=")) return path;
    return `${path}${path.includes("?") ? "&" : "?"}fromBoot=1`;
  }

  function resumeCachedAccount(userId: string) {
    if (redirectingRef.current || pending) return;
    const activated = activateOfflineSession(userId);
    if (!activated) {
      setCachedAccounts(listOfflineSessions());
      toast.error("That offline account is no longer available on this device.");
      return;
    }
    consumeExplicitLogout();
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
  }

  // Cached session resume is offline-only. When the network is back (Electron
  // reconnect, Cap online, browser), never auto-open the previous offline shell —
  // that stole password logins into the wrong account. Show the picker instead.
  useEffect(() => {
    if (redirectingRef.current || pending || isAuthenticated) return;
    if (signedOut) return;
    if (!hasOfflineSession()) return;

    const accounts = listOfflineSessions();
    setCachedAccounts(accounts);
    if (online) return;
    if (accounts.length !== 1) return;

    resumeCachedAccount(accounts[0].userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume once per gate change
  }, [online, isAuthenticated, pending, router, signedOut]);

  // Already signed in without submitting credentials (live Convex cookie).
  // Keep fromBoot so cold start can restore the last in-app route after shell mount.
  // After logout, stay on the form even if the previous cookie has not dropped yet.
  useEffect(() => {
    if (signedOut) return;
    if (!isAuthenticated || authLoading || redirectingRef.current || pending) return;
    redirectingRef.current = true;
    queueMicrotask(() => {
      setOpeningWorkspace(true);
      void (async () => {
        try {
          // Live auth always wins over any previously active offline shell.
          clearOfflineSession();
          const path = await resolvePostLoginPath(convex);
          navigateAfterLogin(withBootMarker(path), router);
        } catch {
          redirectingRef.current = false;
          setOpeningWorkspace(false);
          setCachedAccounts(listOfflineSessions());
          toast.error("Could not open your account. Sign in again.");
        }
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

      // Detach the previous offline shell before Convex auth so we cannot paint
      // the last offline cashier while this email's session is still settling.
      clearOfflineSession();

      const formData = new FormData();
      formData.set("email", normalizedEmail);
      formData.set("password", password);
      formData.set("flow", "signIn");
      formData.set("deviceKey", getLoginDeviceKey());
      await signIn("password", formData);
      consumeExplicitLogout();
      toast.success("Welcome");

      // Fresh password sign-in: bind the live `me` profile (this email), not a cache.
      redirectingRef.current = true;
      setOpeningWorkspace(true);
      const path = await resolvePostLoginPath(convex, undefined, {
        expectedEmail: normalizedEmail,
      });
      navigateAfterLogin(path, router);
    } catch (error) {
      redirectingRef.current = false;
      setOpeningWorkspace(false);
      setCachedAccounts(listOfflineSessions());
      const raw = error instanceof Error ? error.message : "";
      const lower = raw.toLowerCase();
      if (lower.includes("auth provider discovery")) {
        showError(error, SERVER_UNREACHABLE_MESSAGE);
      } else if (lower.includes("profile") || lower.includes("account mismatch")) {
        showError(error, raw || "Could not open that account. Try again.");
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

      {cachedAccounts.length > 0 ? (
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
            <p className="text-foreground text-sm font-medium">
              {online ? "Continue on this device" : "Continue offline"}
            </p>
          </div>
          <ul className="space-y-2">
            {cachedAccounts.map((account) => (
              <li key={account.userId}>
                <button
                  type="button"
                  onClick={() => resumeCachedAccount(account.userId)}
                  className="border-border bg-muted/40 hover:bg-muted/70 focus-visible:ring-ring flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground block truncate text-sm font-medium">
                      {account.name}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs capitalize">
                      {account.role}
                      {account.email ? ` · ${account.email}` : ""}
                      {account.branchName ? ` · ${account.branchName}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {online
              ? "Or sign in with email below to open another account."
              : "No internet needed for accounts already used on this device."}
          </p>
          <div className="border-border relative py-1">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="border-border w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background text-muted-foreground px-2 text-xs">
                Sign in with password
              </span>
            </div>
          </div>
        </div>
      ) : null}

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
