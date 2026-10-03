"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useConvexAuth } from "convex/react";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { isConnectivityError, SERVER_UNREACHABLE_MESSAGE, showError } from "@/lib/errors";
import Image from "next/image";
import { ArrowLeft, Mail } from "lucide-react";
import { isCapacitor, isElectron } from "@novend/hardware";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { APP_NAME } from "@/constants/app";
import { BRANDING } from "@/constants/branding";
import { ROUTES } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { usePublicSiteHref } from "@/features/auth/components/public-site-host";
import {
  clearPostLoginLeavePending,
  markPostLoginLeavePending,
  navigateAfterLogin,
  resolvePostLoginPath,
  resolvePostLoginSession,
} from "@/lib/auth/redirect-after-login";
import { consumeExplicitLogout, clearSigningOutUi, hasExplicitLogout } from "@/lib/auth/logout-flag";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  activateOfflineSession,
  activateOfflineSessionWithFallback,
  listOfflineSessions,
  markOfflineSession,
} from "@/lib/offline/session";
import { storeLocalAuthVerifier, verifyLocalAuth } from "@/lib/offline/local-auth";
import { shellProfileFromSessionHint, saveShellProfile } from "@/lib/offline/shell-profile";
import { resolvePostAuthPath } from "@/lib/auth/safe-return-path";
import { withTimeout } from "@/lib/async/with-timeout";

const REMEMBER_KEY = "novend.login.rememberEmail";
const LOGIN_DEVICE_KEY = "novend.login.deviceKey";
/** Cap/Electron often look online while Convex never answers. */
const CLOUD_SIGN_IN_BUDGET_NATIVE_MS = 8_000;
/** Browser dashboard: allow cold password + token handshake before failing closed. */
const CLOUD_SIGN_IN_BUDGET_WEB_MS = 20_000;
/** Revoke a leftover JWT after sign-out before starting a new password sign-in. */
const STALE_SIGNOUT_BUDGET_MS = 4_000;
let volatileLoginDeviceKey: string | null = null;

function cloudSignInBudgetMs(): number {
  if (typeof window === "undefined") return CLOUD_SIGN_IN_BUDGET_WEB_MS;
  return isCapacitor() || isElectron() ? CLOUD_SIGN_IN_BUDGET_NATIVE_MS : CLOUD_SIGN_IN_BUDGET_WEB_MS;
}

/** Offline password unlock is for Cap/Electron tills when Convex is unreachable. */
function allowOfflinePasswordFallback(): boolean {
  if (typeof window === "undefined") return false;
  return isCapacitor() || isElectron() || !navigator.onLine;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Drop ?signedOut=1 without a React navigation — keeps LoginSessionGate in sync. */
function clearSignedOutQueryParam(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("signedOut")) return;
    url.searchParams.delete("signedOut");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  } catch {
    /* ignore */
  }
}

/** Clear the persistent barrier and the login URL marker after credentials succeed. */
function clearLogoutBarrierAfterCredentialUnlock(): void {
  consumeExplicitLogout();
  clearSignedOutQueryParam();
}

function isTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("timed out") || message.includes("in time") || message.includes("timeout")
  );
}

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
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center" role="status">
          <p className="text-muted-foreground text-sm">Loading sign-in…</p>
        </div>
      }
    >
      <ConfiguredLoginForm compact={compact} />
    </Suspense>
  );
}

function ConfiguredLoginForm({ compact }: { compact: boolean }) {
  const websiteHref = usePublicSiteHref("/");
  const { signIn, signOut } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const online = useConnectivity();
  const convex = useConvex();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromBoot = searchParams.get("fromBoot") === "1";
  const signedOut = searchParams.get("signedOut") === "1" || hasExplicitLogout();
  const redirectingRef = useRef(false);
  const staleCloudLogoutRef = useRef(false);
  /** Bumps when a submit is abandoned so a late `signIn` cannot open the wrong shell. */
  const submitGenerationRef = useRef(0);
  /** Cap / Electron are the product shell — no escape hatch to the marketing site. */
  const [hideWebsiteLink, setHideWebsiteLink] = useState(false);

  useEffect(() => {
    setHideWebsiteLink(isCapacitor() || isElectron());
  }, []);

  // Landed on login — drop the transient “Signing out…” UI so reloads of the
  // form (or fromBoot) never keep that label. Keep the security barrier until
  // credentials unlock.
  useEffect(() => {
    clearSigningOutUi();
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [pending, setPending] = useState(false);
  const [openingWorkspace, setOpeningWorkspace] = useState(false);

  // Offline sign-out cannot immediately revoke the cloud token. Keep the
  // persistent local barrier in place, and revoke that stale token once the
  // device can reach Convex again.
  //
  // Key off hasExplicitLogout() only — never `?signedOut=1`. After a successful
  // password sign-in the URL still says signedOut while isAuthenticated flips
  // true; treating the query param as the barrier immediately signs out the
  // fresh session (first login bounces, second works via staleCloudLogoutRef).
  useEffect(() => {
    if (!online) {
      staleCloudLogoutRef.current = false;
      return;
    }
    if (!hasExplicitLogout()) {
      staleCloudLogoutRef.current = false;
      return;
    }
    if (authLoading || !isAuthenticated) return;
    if (pending || openingWorkspace || redirectingRef.current) return;
    if (staleCloudLogoutRef.current) return;
    staleCloudLogoutRef.current = true;
    void signOut().catch(() => {
      // Retry only after the connectivity state changes again.
    });
  }, [online, authLoading, isAuthenticated, signOut, pending, openingWorkspace]);

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

  async function openOfflineWorkspace(userId: string, email?: string) {
    if (redirectingRef.current) return false;
    let activated =
      activateOfflineSession(userId) ?? (await activateOfflineSessionWithFallback(userId));
    if (!activated) {
      toast.error(
        "No cached workspace for that account on this device. Connect once while online, then try again.",
      );
      return false;
    }
    if (email && activated.email) {
      const activatedEmail = activated.email.trim().toLowerCase();
      if (activatedEmail && activatedEmail !== email) {
        toast.error(
          "Cached workspace does not match that email. Connect online and sign in again.",
        );
        return false;
      }
    }
    if (email && !activated.email) {
      activated = { ...activated, email, savedAt: Date.now() };
      markOfflineSession(activated);
    }
    const profile = shellProfileFromSessionHint(activated);
    if (profile) {
      void saveShellProfile(profile).catch(() => undefined);
    }
    clearLogoutBarrierAfterCredentialUnlock();
    redirectingRef.current = true;
    markPostLoginLeavePending();
    setOpeningWorkspace(true);
    // Keep the form mounted until replace — prepare + navigate must be sync.
    // fromLogin (via navigateAfterLogin) warms the shell without RestoreLastRoute.
    navigateAfterLogin(
      resolvePostAuthPath({
        isPlatformAdmin: false,
        needsOnboarding: false,
        needsProfile: false,
      }),
      router,
      { hard: true },
    );
    return true;
  }

  async function resumeWithLocalPassword(normalizedEmail: string, rawPassword: string) {
    const verified = await verifyLocalAuth(normalizedEmail, rawPassword);
    if (!verified) {
      const remembered = listOfflineSessions().some(
        (row) => row.email?.trim().toLowerCase() === normalizedEmail,
      );
      toast.error(
        remembered
          ? "Incorrect email or password."
          : "This account isn’t set up for offline sign-in on this device yet. Connect once while online, then you can sign in without a signal.",
      );
      return false;
    }
    return await openOfflineWorkspace(verified.userId, verified.email);
  }

  // Already signed in without submitting credentials (live Convex cookie).
  // Keep fromBoot so cold start can restore the last in-app route after shell mount.
  // After logout, stay on the form even if the previous cookie has not dropped yet.
  // Never auto-resume during/after an abandoned credential submit — a late
  // signIn must not open a prior JWT shell for a different email.
  useEffect(() => {
    if (signedOut) return;
    if (!isAuthenticated || authLoading || redirectingRef.current || pending) return;
    if (openingWorkspace) return;
    redirectingRef.current = true;
    markPostLoginLeavePending();
    setOpeningWorkspace(true);
    void (async () => {
      try {
        // Resolve destination while the signing-in cover is painted, then hard-navigate
        // in one sync turn (prepareHardNavigation + replace).
        const path = await resolvePostLoginPath(convex);
        navigateAfterLogin(withBootMarker(path), router, { hard: true });
      } catch {
        clearPostLoginLeavePending();
        redirectingRef.current = false;
        setOpeningWorkspace(false);
        toast.error("Could not open your account. Sign in again.");
      }
    })();
  }, [isAuthenticated, authLoading, convex, router, pending, openingWorkspace, fromBoot, signedOut]);

  async function revokeStaleCloudSessionBeforeSignIn(): Promise<void> {
    if (!hasExplicitLogout()) return;
    if (authLoading || !isAuthenticated) return;
    staleCloudLogoutRef.current = true;
    try {
      await withTimeout(signOut(), STALE_SIGNOUT_BUDGET_MS, "sign-out timed out");
    } catch {
      /* continue — password sign-in still needs to run */
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || redirectingRef.current) {
      return;
    }

    const generation = ++submitGenerationRef.current;
    setPending(true);
    const normalizedEmail = email.trim().toLowerCase();
    const rawPassword = password;
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

      // Offline (or radio lies): verify email + password against the device digest.
      if (!online) {
        const ok = await resumeWithLocalPassword(normalizedEmail, rawPassword);
        setPending(false);
        if (!ok) return;
        return;
      }

      // Serialize revoke of a leftover JWT before password sign-in. Racing
      // signOut + signIn hung past the budget and then auto-resumed the old shell.
      await revokeStaleCloudSessionBeforeSignIn();
      if (generation !== submitGenerationRef.current) return;

      try {
        const formData = new FormData();
        formData.set("email", normalizedEmail);
        formData.set("password", rawPassword);
        formData.set("flow", "signIn");
        formData.set("deviceKey", getLoginDeviceKey());
        await withTimeout(
          signIn("password", formData),
          cloudSignInBudgetMs(),
          "Couldn't reach Novend in time.",
        );
      } catch (cloudError) {
        // Online browser: cloud-only — never open a cached local shell.
        // Cap/Electron (or true offline): typed-email offline unlock only.
        if (isConnectivityError(cloudError) || isTimeoutError(cloudError)) {
          submitGenerationRef.current += 1;
          if (allowOfflinePasswordFallback()) {
            const ok = await resumeWithLocalPassword(normalizedEmail, rawPassword);
            setPending(false);
            if (ok) {
              toast.message("Couldn't reach Novend — opened your cached workspace.");
              return;
            }
          }
          showError(
            cloudError,
            "Couldn't reach Novend. Check the signal and try again.",
          );
          setPending(false);
          return;
        }
        throw cloudError;
      }

      if (generation !== submitGenerationRef.current) {
        setPending(false);
        return;
      }

      redirectingRef.current = true;
      // Password succeeded — drop signedOut barrier now. Leaving it set while
      // authenticated made the stale-JWT effect call signOut() after a slow
      // users.me, bouncing every online login back to /login?signedOut=1.
      // Leave ownership (postLoginLeave) still blocks LoginSessionGate mid-resolve.
      clearLogoutBarrierAfterCredentialUnlock();
      staleCloudLogoutRef.current = false;
      markPostLoginLeavePending();
      setOpeningWorkspace(true);
      // Let Convex Auth attach the new token after signOut→signIn before me.
      await wait(350);
      if (generation !== submitGenerationRef.current) {
        clearPostLoginLeavePending();
        redirectingRef.current = false;
        setOpeningWorkspace(false);
        setPending(false);
        return;
      }
      const session = await resolvePostLoginSession(convex, undefined, {
        expectedEmail: normalizedEmail,
      });
      if (generation !== submitGenerationRef.current) {
        clearPostLoginLeavePending();
        redirectingRef.current = false;
        setOpeningWorkspace(false);
        setPending(false);
        return;
      }
      // bindReplicaFromMe already marked the correct offline/platform session —
      // clearing the active hint here wiped warm-paint and bounced first login.
      try {
        const prepared = await storeLocalAuthVerifier(
          normalizedEmail,
          rawPassword,
          session.userId,
        );
        if (!prepared) {
          toast.warning("Signed in, but this device could not prepare offline sign-in.");
        }
      } catch {
        toast.warning("Signed in, but offline sign-in could not be prepared on this device.");
      }
      navigateAfterLogin(session.path, router, { hard: true });
    } catch (error) {
      submitGenerationRef.current += 1;
      clearPostLoginLeavePending();
      redirectingRef.current = false;
      setOpeningWorkspace(false);

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

  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      {openingWorkspace ? (
        <div className="bg-background absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
          <div
            className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            aria-hidden
          />
          <p className="text-foreground text-sm font-medium">Signing you in…</p>
          <p className="text-muted-foreground text-xs">
            Confirming your cloud account. This can take a few seconds.
          </p>
        </div>
      ) : null}

      <div
        className={openingWorkspace ? "invisible h-0 overflow-hidden" : undefined}
        aria-hidden={openingWorkspace}
      >
        {!hideWebsiteLink ? (
          <Link
            href={websiteHref}
            className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back to website
          </Link>
        ) : null}

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
                className={cn(
                  "text-primary text-sm font-medium hover:underline",
                  !online && "pointer-events-none opacity-50",
                )}
                tabIndex={!online ? -1 : undefined}
                aria-disabled={!online}
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

          <div className="flex items-center gap-2 pt-0.5">
            <Checkbox
              id="login-remember-me"
              checked={rememberMe}
              onCheckedChange={(value) => setRememberMe(value === true)}
            />
            <Label
              htmlFor="login-remember-me"
              className="text-foreground/90 cursor-pointer text-sm font-normal"
            >
              Remember me
            </Label>
          </div>

          <Button
            type="submit"
            className="h-11 w-full text-[15px] font-semibold"
            disabled={pending || openingWorkspace}
            aria-busy={pending || openingWorkspace}
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
