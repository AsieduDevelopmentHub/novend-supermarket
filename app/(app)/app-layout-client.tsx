"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Hardware, isCapacitor, isElectron } from "@novend/hardware";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { AppSidebar, MobileSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { NativeAppServices } from "@/components/layout/native-app-services";
import { RestoreLastRoute } from "@/components/layout/restore-last-route";
import { PlatformShell } from "@/components/layout/platform-shell";
import { ErrorState } from "@/components/feedback/error-state";
import { AppSplash } from "@/features/auth/components/app-splash";
import type { AppRole } from "@/config/navigation";
import { APP_BRAND } from "@/constants/app";
import { BRANDING } from "@/constants/branding";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SyncStatusBanner } from "@/components/offline/sync-status-banner";
import { SyncStatusHeaderButton } from "@/components/offline/sync-status-chip";
import { SyncCenterDialog } from "@/components/offline/sync-center-dialog";
import { LicenseBanner } from "@/features/billing/components/license-banner";
import { EmailVerificationBanner } from "@/features/auth/components/email-verification-banner";
import { CloudReconnectBanner } from "@/features/auth/components/cloud-reconnect-banner";
import { CloudSessionMismatchGate } from "@/features/auth/components/cloud-session-mismatch-gate";
import { DeviceActivationGate } from "@/features/billing/components/device-activation-gate";
import { InstallPromptDialog } from "@/components/install-prompt-dialog";
import { CloudPackageRestoreGate } from "@/features/settings/components/cloud-package-restore-gate";
import { OfflineProvider } from "@/providers/offline-provider";
import { OfflineNavigationProvider, OfflineOutlet } from "@/providers/offline-navigation";
import { OrganizationExperienceRoot } from "@/features/experience/components/organization-experience-root";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useNativeShell } from "@/hooks/use-native-shell";
import { useStandaloneDisplay } from "@/hooks/use-standalone-display";
import {
  loadShellProfile,
  saveShellProfile,
  shellProfileFromSessionHint,
  type ShellProfile,
} from "@/lib/offline/shell-profile";
import {
  markOfflineSession,
  readOfflineSession,
  hasOfflineSession,
  ensureActiveOfflineSession,
  hydrateOfflineSessionsFromDeviceStore,
  listOfflineSessions,
} from "@/lib/offline/session";
import {
  clearSigningOutUi,
  hasExplicitLogout,
  isSigningOutUi,
} from "@/lib/auth/logout-flag";
import {
  clearLocalOnlyCloudUser,
  isAwaitingCloudReconnect,
  LOCAL_ONLY_CLOUD_USER_EVENT,
  readLocalOnlyCloudUserId,
  rememberLocalOnlyCloudUser,
} from "@/lib/auth/awaiting-cloud-reconnect";
import { getCloudSessionIdentityState } from "@/lib/auth/cloud-session-identity";
import { forceLeaveToLoginAfterSignOut } from "@/lib/auth/native-auth-navigation";
import { clearPostLoginLeavePending } from "@/lib/auth/redirect-after-login";
import { useOfflineSessionHint } from "@/hooks/use-offline-session-hint";
import {
  bindPlatformOfflineDb,
  markPlatformOfflineSession,
  readPlatformOfflineSession,
  type PlatformOfflineSession,
} from "@/lib/offline/platform-cache";
import { bindOfflineOrganization } from "@/lib/offline/db";
import { toUserMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { describeClientDevice, telemetryRuntimeForDevice } from "@/lib/device";
import { TelemetryProvider } from "@/providers/telemetry-provider";
import { PushRegistrationHost } from "@/providers/push-registration";
import { PushRegistrationErrorBoundary } from "@/providers/push-registration-boundary";
import { ProductTourProvider } from "@/features/tours/tour-provider";
import { CustomerDisplayServices } from "@/features/customer-display/components/customer-display-services";
import {
  WorkspaceLockOverlay,
  type WorkspaceLockIdentity,
} from "@/features/auth/components/workspace-lock-overlay";
import { useWorkspaceIdleLock } from "@/hooks/use-workspace-idle-lock";

const OFFLINE_AUTH_BUDGET_MS = 1200;
/** Cap/Web often look "online" while Convex never settles — fail soft into cache/login. */
const ONLINE_AUTH_BUDGET_MS = 4500;
/** Show Try again / Close app if sign-out navigation never leaves the splash. */
const SIGN_OUT_ESCAPE_MS = 1200;

/** Post-credential hard leave — keep one splash label until the shell paints. */
function isPostLoginWarm(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("fromLogin") === "1";
  } catch {
    return false;
  }
}

/**
 * Leave splash while the logout barrier blocks the shell.
 * “Signing out…” only for the in-tab leave UI flag — a hard reload / later
 * remount with the persistent barrier must say Opening sign-in, not Signing out.
 */
function SigningOutSplash({ activeLeave }: { activeLeave: boolean }) {
  const [showEscape, setShowEscape] = useState(false);
  const canQuitNative = isCapacitor() || isElectron();

  useEffect(() => {
    const timer = window.setTimeout(() => setShowEscape(true), SIGN_OUT_ESCAPE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (activeLeave) return;
    // Stale barrier on reload: drop the session UI so later paints stay honest.
    clearSigningOutUi();
  }, [activeLeave]);

  return (
    <AppSplash
      label={activeLeave ? "Signing out…" : "Opening sign-in…"}
      showLabel
      footer={
        showEscape ? (
          <>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => {
                // Always force-leave — soft navigateToLogin can hang the same
                // HTTPS path that stranded this splash (online→offline Electron).
                forceLeaveToLoginAfterSignOut();
              }}
            >
              Try again
            </Button>
            {canQuitNative ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => {
                  void Hardware.app.exitApp();
                }}
              >
                Close app
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => {
                  forceLeaveToLoginAfterSignOut();
                }}
              >
                Open login
              </Button>
            )}
          </>
        ) : null
      }
    />
  );
}

/** Idle lock only after the authenticated tenant/platform shell is ready to paint. */
function AppShellWithIdleLock({
  identity,
  children,
}: {
  identity: WorkspaceLockIdentity | null;
  children: ReactNode;
}) {
  const { locked, unlock } = useWorkspaceIdleLock({ enabled: true });

  function handleUnlocked() {
    unlock();
    // After the overlay unmounts: restore focus + re-sync client shell routing so
    // sidebar links and the current page respond without a hard reload.
    window.setTimeout(() => {
      const main = document.querySelector("[data-novend-scroll-root]");
      if (main instanceof HTMLElement) {
        if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
        main.focus({ preventScroll: true });
      }
      // Never refresh the Next document without a Convex JWT — middleware 302s to
      // /login and drops an offline shell that was waiting to reconnect.
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, 0);
  }

  return (
    <>
      {children}
      {locked ? <WorkspaceLockOverlay identity={identity} onUnlocked={handleUnlocked} /> : null}
    </>
  );
}

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const configured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  if (!configured) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold">Service unavailable</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          Novend isn&apos;t connected to its cloud service in this environment. Contact your
          administrator, then try again.
        </p>
        <Button asChild>
          <Link href="/login">Open login</Link>
        </Button>
      </div>
    );
  }

  return <AuthenticatedAppShell>{children}</AuthenticatedAppShell>;
}

function AuthenticatedAppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const online = useConnectivity();
  const nativeShell = useNativeShell();
  const standaloneDisplay = useStandaloneDisplay();
  const needsPwaStatusPad = !nativeShell && standaloneDisplay;
  const sessionHint = useOfflineSessionHint();
  const ensureProfile = useMutation(api.profiles.ensureProfile);
  const heartbeat = useMutation(api.users.heartbeat);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [cachedProfile, setCachedProfile] = useState<ShellProfile | null>(null);
  const [platformSession, setPlatformSession] = useState<PlatformOfflineSession | null>(null);
  const [cacheReady, setCacheReady] = useState(false);
  const [offlineAuthBudgetElapsed, setOfflineAuthBudgetElapsed] = useState(false);
  const [onlineAuthBudgetElapsed, setOnlineAuthBudgetElapsed] = useState(false);
  const [cloudSwitchUserId, setCloudSwitchUserId] = useState<string | null>(null);
  const [localOnlyUserId, setLocalOnlyUserId] = useState<string | null>(
    readLocalOnlyCloudUserId,
  );
  // Once the mismatch gate is visible, stop its live users.me subscription.
  // A stale/expired JWT can otherwise throw after the modal paints and replace
  // the cashier's decision with the global error screen.
  // localOnlyUserId alone must not suppress after a successful cloud reconnect —
  // that deadlocked Verifying forever. Quarantine local-only only while unsigned.
  const suppressCloudIdentityQuery = Boolean(
    cloudSwitchUserId || (localOnlyUserId && !isAuthenticated),
  );
  const user = useQuery(
    api.users.me,
    isAuthenticated && online && !suppressCloudIdentityQuery ? {} : "skip",
  );
  const bootstrapping = useRef(false);
  const multiBranchReady = useRef(false);

  useEffect(() => {
    const syncLocalOnlyChoice = () => setLocalOnlyUserId(readLocalOnlyCloudUserId());
    window.addEventListener(LOCAL_ONLY_CLOUD_USER_EVENT, syncLocalOnlyChoice);
    return () => {
      window.removeEventListener(LOCAL_ONLY_CLOUD_USER_EVENT, syncLocalOnlyChoice);
    };
  }, []);
  const loginRedirectStarted = useRef(false);

  const activeLocalUserId = sessionHint?.userId ?? cachedProfile?.userId ?? null;
  const activeLocalOrganizationId =
    sessionHint?.organizationId ?? cachedProfile?.organizationId ?? null;
  const localOnlyReady =
    Boolean(activeLocalUserId) &&
    localOnlyUserId === activeLocalUserId &&
    !isAuthenticated;
  const cloudIdentityState = getCloudSessionIdentityState({
    online,
    isAuthenticated,
    localIdentity: activeLocalUserId
      ? {
          userId: activeLocalUserId,
          organizationId: activeLocalOrganizationId,
        }
      : null,
    cloudIdentity:
      user === undefined
        ? undefined
        : user?.userId
          ? {
              userId: String(user.userId),
              organizationId:
                "organizationId" in user && user.organizationId
                  ? String(user.organizationId)
                  : null,
            }
          : null,
  });
  const cloudIdentityUnsafe =
    Boolean(activeLocalUserId) &&
    !localOnlyReady &&
    (cloudSwitchUserId === activeLocalUserId ||
      (online && isAuthenticated && cloudIdentityState !== "matched"));

  // Open Dexie + restore shell identity before auth/network settle.
  // Never resurrect a signed-out user's Dexie profile (that re-marks
  // novend.offlineSession and traps the next login in the splash).
  useEffect(() => {
    // Credential leave completed — drop the login-page latch.
    clearPostLoginLeavePending();
    let cancelled = false;
    void (async () => {
      await hydrateOfflineSessionsFromDeviceStore();
      const hint = hasExplicitLogout()
        ? null
        : (readOfflineSession() ?? ensureActiveOfflineSession());
      const profile = await loadShellProfile();
      if (cancelled) return;
      if (!hint) {
        setCachedProfile(null);
        setCacheReady(true);
        return;
      }
      if (profile && profile.userId === hint.userId) {
        setCachedProfile(profile);
      } else {
        setCachedProfile(shellProfileFromSessionHint(hint));
      }
      const platformHint = readPlatformOfflineSession();
      if (platformHint) {
        setPlatformSession(platformHint);
        bindPlatformOfflineDb(platformHint.userId);
      }
      setCacheReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-activate a registry shell when the active key expired/cleared so
  // Cap/Electron reconnect paints POS chrome instead of bouncing to /login.
  useEffect(() => {
    if (isAuthenticated || hasExplicitLogout()) return;
    if (sessionHint) return;
    if (!hasOfflineSession()) return;
    ensureActiveOfflineSession();
  }, [isAuthenticated, sessionHint]);

  // One owner for the app-shell → login handoff. The previous flow issued a
  // soft redirect, a timed hard redirect, and another hard redirect during
  // render, which made Cap/Electron visibly reload two or three times.
  useEffect(() => {
    if (loginRedirectStarted.current || hasExplicitLogout()) return;
    if (!cacheReady || isAuthenticated) return;
    // Continue locally from the password modal — never bounce to /login.
    if (localOnlyUserId || readLocalOnlyCloudUserId()) return;
    if (sessionHint || cachedProfile || platformSession) return;
    if (hasOfflineSession() || readOfflineSession()) return;
    if (ensureActiveOfflineSession()) return;

    const authBudgetElapsed = online ? onlineAuthBudgetElapsed : offlineAuthBudgetElapsed;
    if (isLoading && !authBudgetElapsed) return;

    loginRedirectStarted.current = true;
    multiBranchReady.current = false;

    const next = new URL("/login", window.location.origin);
    const fromBoot = new URLSearchParams(window.location.search).get("fromBoot") === "1";
    if (!online || fromBoot) {
      next.searchParams.set("fromBoot", "1");
    }
    window.location.replace(`${next.pathname}${next.search}`);
  }, [
    cacheReady,
    cachedProfile,
    isAuthenticated,
    isLoading,
    localOnlyUserId,
    offlineAuthBudgetElapsed,
    online,
    onlineAuthBudgetElapsed,
    platformSession,
    sessionHint,
  ]);

  useEffect(() => {
    if (online || (!isLoading && isAuthenticated)) {
      queueMicrotask(() => setOfflineAuthBudgetElapsed(false));
      return;
    }
    const timer = window.setTimeout(
      () => setOfflineAuthBudgetElapsed(true),
      OFFLINE_AUTH_BUDGET_MS,
    );
    return () => window.clearTimeout(timer);
  }, [online, isLoading, isAuthenticated]);

  // Start once per online session. Do not key this on isLoading/user —
  // Cap Convex flickers those and would reset the 4.5s budget forever,
  // trapping post-login on "Preparing workspace…".
  useEffect(() => {
    if (!online) {
      queueMicrotask(() => setOnlineAuthBudgetElapsed(false));
      return;
    }
    const timer = window.setTimeout(() => setOnlineAuthBudgetElapsed(true), ONLINE_AUTH_BUDGET_MS);
    return () => window.clearTimeout(timer);
  }, [online]);

  // Dead radio / hung leave: never leave cashiers on “Signing out…”.
  useEffect(() => {
    if (!hasExplicitLogout()) return;
    const timer = window.setTimeout(() => {
      if (!hasExplicitLogout()) return;
      if (window.location.pathname.startsWith("/login")) return;
      forceLeaveToLoginAfterSignOut();
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [sessionHint, isAuthenticated, online]);

  // Keep the identity gate mounted while it replaces a stale cloud account.
  // signOut briefly flips Convex to unauthenticated; clearing the gate at that
  // point would mount sync providers before the intended local user signs in.
  // Do not clear the latch on a connectivity flap — that remounts OfflineProvider
  // while a stale JWT can still be present.
  useEffect(() => {
    if (!activeLocalUserId || hasExplicitLogout()) {
      if (cloudSwitchUserId !== null) {
        queueMicrotask(() => setCloudSwitchUserId(null));
      }
      if (localOnlyUserId !== null) {
        queueMicrotask(() => setLocalOnlyUserId(null));
      }
      clearLocalOnlyCloudUser();
      return;
    }
    if (localOnlyReady) {
      if (cloudSwitchUserId !== null) {
        queueMicrotask(() => setCloudSwitchUserId(null));
      }
      return;
    }
    if (cloudIdentityState === "mismatch") {
      if (cloudSwitchUserId !== activeLocalUserId) {
        queueMicrotask(() => setCloudSwitchUserId(activeLocalUserId));
      }
      return;
    }
    if (cloudIdentityState === "matched") {
      if (cloudSwitchUserId !== null) {
        queueMicrotask(() => setCloudSwitchUserId(null));
      }
      if (localOnlyUserId !== null) {
        queueMicrotask(() => setLocalOnlyUserId(null));
      }
      clearLocalOnlyCloudUser();
    }
    // checking / not-required: keep an existing latch sticky across flaps.
  }, [
    activeLocalUserId,
    cloudIdentityState,
    cloudSwitchUserId,
    localOnlyReady,
    localOnlyUserId,
  ]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !online ||
      cloudIdentityUnsafe ||
      !user ||
      user.needsProfile ||
      !user.role ||
      (!user.branch && !user.branchId) ||
      !user.branchId
    ) {
      return;
    }
    if ("organizationId" in user && user.organizationId) {
      bindOfflineOrganization(String(user.organizationId), String(user.userId));
    }
    const next: ShellProfile = {
      userId: String(user.userId),
      name: user.name,
      role: user.role as AppRole,
      branchId: user.branchId,
      branchName: user.branch ?? "Branch",
      imageUrl: user.imageUrl ?? null,
      email: user.email ?? null,
      phone: user.phone ?? null,
      organizationName: user.organizationName ?? null,
      organizationId:
        "organizationId" in user && user.organizationId ? String(user.organizationId) : null,
    };
    void saveShellProfile(next).then(() => {
      setCachedProfile(next);
      markOfflineSession({
        userId: next.userId,
        name: next.name,
        email: next.email ?? undefined,
        role: next.role,
        branchId: next.branchId,
        branchName: next.branchName,
        organizationId: next.organizationId ?? undefined,
        savedAt: Date.now(),
      });
    });
  }, [user, isAuthenticated, online, cloudIdentityUnsafe]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !user ||
      cloudIdentityUnsafe ||
      multiBranchReady.current ||
      bootstrapping.current
    ) {
      return;
    }
    if (!online) return;
    if (user.isPlatformAdmin && !user.role) {
      if (!pathname.startsWith("/platform")) {
        router.replace("/platform");
      }
      return;
    }
    if (user.needsOnboarding || user.needsProfile) {
      if (pathname !== "/onboarding") {
        router.replace("/onboarding");
      }
      return;
    }

    bootstrapping.current = true;

    void (async () => {
      setProfileError(null);
      try {
        await ensureProfile({
          name: user.name,
          role: user.role === "administrator" ? "administrator" : "cashier",
          branch: "Main Branch",
        });
        multiBranchReady.current = true;
      } catch (error: unknown) {
        setProfileError(toUserMessage(error, "Could not set up account"));
      } finally {
        bootstrapping.current = false;
      }
    })();
  }, [
    ensureProfile,
    isAuthenticated,
    online,
    user,
    router,
    pathname,
    cloudIdentityUnsafe,
  ]);

  useEffect(() => {
    if (
      !online ||
      !isAuthenticated ||
      cloudIdentityUnsafe ||
      !user ||
      user.needsProfile ||
      !user.role
    ) {
      return;
    }

    const HEARTBEAT_MS = 15 * 60_000;
    let cancelled = false;
    let interval: number | undefined;
    let identityPayload:
      | {
          device: string;
          runtime: ReturnType<typeof telemetryRuntimeForDevice>;
          appVersion: string | undefined;
        }
      | undefined;

    function tick() {
      if (cancelled || !identityPayload) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void heartbeat(identityPayload);
    }

    void describeClientDevice().then((identity) => {
      if (cancelled) return;
      identityPayload = {
        device: identity.name,
        runtime: telemetryRuntimeForDevice(identity),
        appVersion: identity.appVersion,
      };
      tick();
      interval = window.setInterval(tick, HEARTBEAT_MS);
    });

    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [heartbeat, isAuthenticated, online, user, cloudIdentityUnsafe]);

  useEffect(() => {
    if (cloudIdentityUnsafe || !user?.isPlatformAdmin || !user.userId) return;
    const next: PlatformOfflineSession = {
      userId: String(user.userId),
      name: user.name,
      email: user.email ?? null,
      hasTenantRole: Boolean(user.role),
      savedAt: Date.now(),
    };
    markPlatformOfflineSession(next);
    setPlatformSession(next);
  }, [user, cloudIdentityUnsafe]);

  const expectedCloudSession =
    sessionHint ??
    (cachedProfile?.userId
      ? {
          userId: cachedProfile.userId,
          name: cachedProfile.name,
          email: cachedProfile.email ?? undefined,
          organizationId: cachedProfile.organizationId ?? undefined,
        }
      : null);
  const switchingCloudAccount =
    Boolean(activeLocalUserId) &&
    !localOnlyReady &&
    cloudSwitchUserId === activeLocalUserId;
  // Prefer the password gate over the verifying splash once a switch is latched —
  // signOut→signIn briefly puts users.me in "checking" and must not unmount the form.
  const cloudIdentityBlocked =
    Boolean(activeLocalUserId) &&
    (cloudIdentityState === "mismatch" || switchingCloudAccount);
  const cloudIdentityChecking =
    online &&
    isAuthenticated &&
    Boolean(activeLocalUserId) &&
    cloudIdentityState === "checking" &&
    !switchingCloudAccount;

  function continueWithLocalSession() {
    if (!activeLocalUserId) return;
    // Persist before signOut starts. Convex auth can flicker or the guarded tree
    // can remount while the stale cloud token is being closed. Cookie + session
    // latch must land before JWT clear so middleware does not 302 to /login.
    rememberLocalOnlyCloudUser(activeLocalUserId);
    setLocalOnlyUserId(activeLocalUserId);
    // Keep users.me quarantined until signOut flips isAuthenticated — otherwise
    // a hung-checking gate (no cloudSwitch latch) can throw over Continue locally.
    if (cloudSwitchUserId !== activeLocalUserId) {
      setCloudSwitchUserId(activeLocalUserId);
    }
    loginRedirectStarted.current = false;
  }

  function resumeCloudVerification() {
    clearLocalOnlyCloudUser();
    setLocalOnlyUserId(null);
    setCloudSwitchUserId(null);
  }

  if (cloudIdentityBlocked) {
    if (expectedCloudSession) {
      return (
        <CloudSessionMismatchGate
          session={expectedCloudSession}
          onContinueLocally={continueWithLocalSession}
          onCloudConnected={resumeCloudVerification}
        />
      );
    }
    return <AppSplash label="Securing account…" showLabel />;
  }

  // Hung users.me must not trap cashiers on Verifying forever — escalate to the
  // password gate (or local-only) once the online auth budget elapses.
  if (cloudIdentityChecking && onlineAuthBudgetElapsed && expectedCloudSession) {
    return (
      <CloudSessionMismatchGate
        session={expectedCloudSession}
        onContinueLocally={continueWithLocalSession}
        onCloudConnected={resumeCloudVerification}
      />
    );
  }

  if (cloudIdentityChecking) {
    return <AppSplash label="Verifying account…" showLabel />;
  }

  // Registry fallback (read-only) so reconnect paints chrome before the
  // ensureActive effect rewrites the active key. Never paint a prior cashier
  // when a platform offline session is claimed.
  const registryHint =
    !sessionHint &&
    !platformSession &&
    typeof window !== "undefined" &&
    !readPlatformOfflineSession()
      ? (listOfflineSessions()[0] ?? null)
      : null;
  const hintProfile = sessionHint
    ? shellProfileFromSessionHint(sessionHint)
    : registryHint
      ? shellProfileFromSessionHint(registryHint)
      : null;
  const resolvedCache = cachedProfile ?? hintProfile;

  const resolvedPlatformSession: PlatformOfflineSession | null =
    user?.isPlatformAdmin && user.userId
      ? {
          userId: String(user.userId),
          name: user.name,
          email: user.email ?? null,
          hasTenantRole: Boolean(user.role),
          savedAt: platformSession?.savedAt ?? 0,
        }
      : platformSession;

  // Keep Dexie bound to the platform replica on Super Admin routes, otherwise the tenant org.
  // Bind during render (before OfflineProvider children effects) so the first snapshot
  // targets the correct org DB — not novend-offline-anon.
  if (user?.userId) {
    if (pathname.startsWith("/platform") && user.isPlatformAdmin) {
      bindPlatformOfflineDb(String(user.userId));
    } else if ("organizationId" in user && user.organizationId) {
      bindOfflineOrganization(String(user.organizationId), String(user.userId));
    }
  } else if (resolvedCache?.organizationId && resolvedCache.userId) {
    bindOfflineOrganization(resolvedCache.organizationId, resolvedCache.userId);
  }

  const replicaKey =
    user?.userId && pathname.startsWith("/platform") && user.isPlatformAdmin
      ? `platform-${user.userId}`
      : user?.userId && "organizationId" in user && user.organizationId
        ? `org-${user.organizationId}-${user.userId}`
        : resolvedCache?.organizationId && resolvedCache.userId
          ? `org-${resolvedCache.organizationId}-${resolvedCache.userId}`
          : "anon";

  const liveReady = Boolean(
    user && !user.needsProfile && user.role && (user.branch || user.branchId),
  );

  /** Stale-looking online (Convex hung) but we have a local shell — treat like offline session. */
  const logoutBarrier = hasExplicitLogout();
  const activeSigningOutUi = isSigningOutUi();
  const awaitingCloudReconnect = isAwaitingCloudReconnect({
    isAuthenticated,
    sessionHint,
  });
  const allowCachedShell =
    Boolean(resolvedCache) &&
    !logoutBarrier &&
    (isAuthenticated || awaitingCloudReconnect || localOnlyReady);
  const cachedShellWhileOnlineHung =
    online &&
    onlineAuthBudgetElapsed &&
    allowCachedShell &&
    (isLoading || !isAuthenticated || user === undefined);

  // After onboarding the session hint exists before Convex `users.me` settles.
  // Paint that shell immediately so "Setting up your account…" cannot stack
  // on top of dashboard, and replicaKey stays org-scoped (no anon remount).
  const shellFromCache =
    allowCachedShell && resolvedCache && !liveReady
      ? {
          name: resolvedCache.name,
          role: resolvedCache.role,
          branch: resolvedCache.branchName,
          imageUrl: resolvedCache.imageUrl,
          organizationName: resolvedCache.organizationName,
        }
      : null;

  const offlineSessionOk =
    !online &&
    Boolean(resolvedCache) &&
    (isAuthenticated || offlineAuthBudgetElapsed || !isLoading);

  const waitingForUser =
    !resolvedCache &&
    !resolvedPlatformSession &&
    ((online && isLoading && !onlineAuthBudgetElapsed) ||
      (online && isAuthenticated && user === undefined && !onlineAuthBudgetElapsed) ||
      (!online && !cacheReady) ||
      (!online && isLoading && !offlineAuthBudgetElapsed));

  if (waitingForUser) {
    return (
      <AppSplash
        label={isPostLoginWarm() ? "Opening workspace…" : "Preparing workspace…"}
        showLabel={isPostLoginWarm()}
      />
    );
  }

  if (logoutBarrier) {
    return <SigningOutSplash activeLeave={activeSigningOutUi} />;
  }

  if (
    !isAuthenticated &&
    online &&
    !cachedShellWhileOnlineHung &&
    !resolvedCache &&
    !awaitingCloudReconnect &&
    !localOnlyReady
  ) {
    return <AppSplash label="Redirecting to login…" />;
  }

  // The effect above owns this root-layout handoff. Rendering stays pure so
  // React retries cannot schedule additional document navigations.
  if (
    cacheReady &&
    (!online || cachedShellWhileOnlineHung) &&
    !resolvedCache &&
    !resolvedPlatformSession
  ) {
    return <AppSplash label="Opening sign-in…" />;
  }

  const isPlatformRoute = pathname.startsWith("/platform");
  const platformAdminOnly = Boolean(user?.isPlatformAdmin) && !user?.role;

  // Authenticated but not in `platformAdmins` — Super Admin queries throw Forbidden
  // ("You don't have permission"), which used to crash into the app error boundary.
  if (isPlatformRoute && online && user && !user.isPlatformAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <ErrorState
          title="Platform access required"
          message="This account is not a Novend platform administrator. Organization owners use the POS, not /platform. Ask a Novend operator to grant platform access if you need the console."
        />
        <Button type="button" variant="outline" onClick={() => router.replace("/dashboard")}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  if (platformAdminOnly && !isPlatformRoute) {
    return <AppSplash label="Opening platform…" />;
  }

  const showPlatformShell =
    (Boolean(user?.isPlatformAdmin) && (!user?.role || isPlatformRoute)) ||
    (!online && isPlatformRoute && Boolean(resolvedPlatformSession));

  if (showPlatformShell) {
    return (
      <NativeAppServices>
        <AppShellWithIdleLock
          identity={
            resolvedPlatformSession
              ? {
                  userId: resolvedPlatformSession.userId,
                  name: resolvedPlatformSession.name,
                  email: resolvedPlatformSession.email,
                }
              : null
          }
        >
          <OfflineProvider key={replicaKey}>
            <OfflineNavigationProvider>
              <ProductTourProvider
                enabled={Boolean(isAuthenticated || resolvedPlatformSession)}
                identityKey={
                  user?.userId
                    ? String(user.userId)
                    : resolvedPlatformSession?.email
                      ? resolvedPlatformSession.email
                      : null
                }
                role={(user?.role as AppRole | undefined) ?? null}
                isPlatformAdmin={Boolean(user?.isPlatformAdmin || resolvedPlatformSession)}
                initialProgress={user?.tourProgress}
              >
                <RestoreLastRoute />
                <TelemetryProvider enabled={Boolean(isAuthenticated && online)} />
                <PlatformShell
                  hasTenantRole={Boolean(user?.role ?? resolvedPlatformSession?.hasTenantRole)}
                  sessionName={user?.name ?? resolvedPlatformSession?.name}
                  sessionEmail={user?.email ?? resolvedPlatformSession?.email ?? null}
                >
                  <OfflineOutlet>{children}</OfflineOutlet>
                </PlatformShell>
              </ProductTourProvider>
            </OfflineNavigationProvider>
          </OfflineProvider>
        </AppShellWithIdleLock>
      </NativeAppServices>
    );
  }

  if (!liveReady && !shellFromCache && !offlineSessionOk && !cachedShellWhileOnlineHung) {
    // Offline shell without JWT: stay off /login — effect + registry hint should
    // already have produced resolvedCache; only splash briefly if storage is empty.
    if (awaitingCloudReconnect) {
      return <AppSplash label="Opening workspace…" showLabel={isPostLoginWarm()} />;
    }
    if (profileError) {
      return (
        <div className="flex min-h-screen items-center justify-center px-4">
          <ErrorState
            title="Account setup failed"
            message={profileError}
            onRetry={() => {
              bootstrapping.current = false;
              multiBranchReady.current = false;
              setProfileError(null);
            }}
          />
        </div>
      );
    }

    if (
      onlineAuthBudgetElapsed &&
      !resolvedCache &&
      !resolvedPlatformSession &&
      !hasOfflineSession()
    ) {
      return <AppSplash label="Redirecting to login…" />;
    }

    return (
      <AppSplash
        label={isPostLoginWarm() ? "Opening workspace…" : "Setting up your account…"}
        showLabel={isPostLoginWarm()}
      />
    );
  }

  const shellUser = liveReady
    ? {
        name: user!.name,
        role: user!.role as AppRole,
        branch: user!.branch ?? "Unassigned",
        imageUrl: user!.imageUrl ?? null,
        organizationName: user!.organizationName ?? null,
        isPlatformAdmin: Boolean(user!.isPlatformAdmin),
      }
    : {
        ...shellFromCache!,
        organizationName: shellFromCache!.organizationName,
      };

  const lockIdentity: WorkspaceLockIdentity | null =
    liveReady && user?.userId
      ? { userId: String(user.userId), name: user.name, email: user.email ?? null }
      : resolvedCache
        ? { userId: resolvedCache.userId, name: resolvedCache.name, email: resolvedCache.email }
        : null;

  const isCustomerDisplayRoute = pathname === "/customer-display";

  if (isCustomerDisplayRoute) {
    return (
      <NativeAppServices>
        <OfflineProvider key={replicaKey}>
          <OfflineNavigationProvider>
            <OrganizationExperienceRoot>
              <TelemetryProvider enabled={Boolean(isAuthenticated && online)} />
              <div className="bg-background h-dvh overflow-hidden">
                <OfflineOutlet>{children}</OfflineOutlet>
              </div>
            </OrganizationExperienceRoot>
          </OfflineNavigationProvider>
        </OfflineProvider>
      </NativeAppServices>
    );
  }

  return (
    <NativeAppServices>
      <AppShellWithIdleLock identity={lockIdentity}>
        <OfflineProvider key={replicaKey}>
          <OfflineNavigationProvider>
            <OrganizationExperienceRoot>
              <ProductTourProvider
                // Auto-start only needs a live session; offline shells still
                // mount the provider so manual “Restart tour” works later.
                enabled={Boolean(liveReady || offlineSessionOk)}
                identityKey={
                  user?.userId
                    ? String(user.userId)
                    : resolvedCache?.userId
                      ? String(resolvedCache.userId)
                      : null
                }
                role={shellUser.role}
                isPlatformAdmin={Boolean(
                  "isPlatformAdmin" in shellUser && shellUser.isPlatformAdmin,
                )}
                initialProgress={user?.tourProgress}
              >
                <RestoreLastRoute />
                <CloudPackageRestoreGate />
                <CustomerDisplayServices />
                <PushRegistrationErrorBoundary>
                  <PushRegistrationHost />
                </PushRegistrationErrorBoundary>
                <TelemetryProvider enabled={Boolean(isAuthenticated && online)} />
                <div
                  className={cn(
                    "bg-background flex h-dvh max-h-dvh overflow-hidden overscroll-none",
                    nativeShell && "native-shell",
                  )}
                >
                  {nativeShell ? null : <AppSidebar user={shellUser} />}
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    {nativeShell ? <div className="native-status-bar" aria-hidden /> : null}
                    {needsPwaStatusPad ? (
                      <div className="app-status-bar lg:hidden" aria-hidden />
                    ) : null}
                    {nativeShell ? null : (
                      <header className="border-border bg-card z-20 flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:hidden">
                        <MobileSidebar user={shellUser} />
                        <Image
                          src={BRANDING.brandmark}
                          alt=""
                          width={32}
                          height={32}
                          unoptimized
                          className="h-8 w-8 shrink-0 object-contain"
                        />
                        <p className="min-w-0 flex-1 truncate text-base font-semibold">
                          {shellUser.organizationName?.trim() || APP_BRAND}
                        </p>
                        <SyncStatusHeaderButton />
                      </header>
                    )}
                    <LicenseBanner />
                    <EmailVerificationBanner />
                    <CloudReconnectBanner />
                    <SyncStatusBanner />
                    {nativeShell ? (
                      <div className="native-page-header-row shrink-0">
                        <div
                          id="native-page-header-host"
                          className="native-page-header-host min-w-0 flex-1"
                        />
                        <SyncStatusHeaderButton />
                      </div>
                    ) : null}
                    <main
                      data-novend-scroll-root
                      data-tour="page-content"
                      className={cn(
                        "min-h-0 min-w-0 flex-1 overscroll-y-contain",
                        nativeShell
                          ? "max-w-full overflow-x-clip overflow-y-auto px-[var(--mobile-page-pad)] pt-3 pb-5"
                          : "overflow-x-hidden overflow-y-auto px-4 py-6 lg:px-8",
                        nativeShell && "pb-[var(--novend-tabbar-offset)]",
                      )}
                    >
                      <OfflineOutlet>{children}</OfflineOutlet>
                    </main>
                  </div>
                  {nativeShell ? <MobileBottomNav /> : null}
                </div>
                <SyncCenterDialog />
                <InstallPromptDialog />
                <DeviceActivationGate enabled={Boolean(liveReady)} />
              </ProductTourProvider>
            </OrganizationExperienceRoot>
          </OfflineNavigationProvider>
        </OfflineProvider>
      </AppShellWithIdleLock>
    </NativeAppServices>
  );
}
