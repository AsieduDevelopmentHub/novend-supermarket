"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
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
import { markOfflineSession, readOfflineSession, hasOfflineSession } from "@/lib/offline/session";
import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import { isAwaitingCloudReconnect } from "@/lib/auth/awaiting-cloud-reconnect";
import { navigateToLoginAfterSignOut } from "@/lib/auth/native-auth-navigation";
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
import { WorkspaceLockOverlay } from "@/features/auth/components/workspace-lock-overlay";
import { useWorkspaceIdleLock } from "@/hooks/use-workspace-idle-lock";

const OFFLINE_AUTH_BUDGET_MS = 1200;
/** Cap/Web often look "online" while Convex never settles — fail soft into cache/login. */
const ONLINE_AUTH_BUDGET_MS = 4500;

/** Idle lock only after the authenticated tenant/platform shell is ready to paint. */
function AppShellWithIdleLock({
  userName,
  children,
}: {
  userName: string | null;
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
      {locked ? <WorkspaceLockOverlay userName={userName} onUnlocked={handleUnlocked} /> : null}
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
  const user = useQuery(api.users.me, isAuthenticated && online ? {} : "skip");
  const ensureProfile = useMutation(api.profiles.ensureProfile);
  const heartbeat = useMutation(api.users.heartbeat);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [cachedProfile, setCachedProfile] = useState<ShellProfile | null>(null);
  const [platformSession, setPlatformSession] = useState<PlatformOfflineSession | null>(null);
  const [cacheReady, setCacheReady] = useState(false);
  const [offlineAuthBudgetElapsed, setOfflineAuthBudgetElapsed] = useState(false);
  const [onlineAuthBudgetElapsed, setOnlineAuthBudgetElapsed] = useState(false);
  const bootstrapping = useRef(false);
  const multiBranchReady = useRef(false);

  // Open Dexie + restore shell identity before auth/network settle.
  // Never resurrect a signed-out user's Dexie profile (that re-marks
  // novend.offlineSession and traps the next login in the splash).
  useEffect(() => {
    let cancelled = false;
    void loadShellProfile().then((profile) => {
      if (cancelled) return;
      const hint = readOfflineSession();
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
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Never kick a cashier who already has a local offline shell just because
  // the radio came back — offline login has no Convex JWT until they connect
  // in place (CloudReconnectBanner). Forcing /login here dropped remote tills.
  useEffect(() => {
    if (!online || isAuthenticated) return;
    if (isAwaitingCloudReconnect({ isAuthenticated, sessionHint })) return;
    if (hasExplicitLogout()) return;
    if (hasOfflineSession() || readOfflineSession() || sessionHint) return;
    if (isLoading && !onlineAuthBudgetElapsed) return;

    router.replace("/login");
    multiBranchReady.current = false;

    const hardNav = window.setTimeout(() => {
      if (window.location.pathname.startsWith("/login")) return;
      if (isAwaitingCloudReconnect({ isAuthenticated: false, sessionHint })) return;
      if (hasOfflineSession() || readOfflineSession() || sessionHint) return;
      const next = new URL("/login", window.location.origin);
      if (new URLSearchParams(window.location.search).get("fromBoot") === "1") {
        next.searchParams.set("fromBoot", "1");
      }
      window.location.assign(`${next.pathname}${next.search}`);
    }, 1600);

    return () => window.clearTimeout(hardNav);
  }, [isAuthenticated, isLoading, online, onlineAuthBudgetElapsed, router, sessionHint]);

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

  // Dead radio / hung Electron trampoline: never leave cashiers on “Signing out…”.
  useEffect(() => {
    if (!hasExplicitLogout()) return;
    const timer = window.setTimeout(() => {
      if (!hasExplicitLogout()) return;
      if (window.location.pathname.startsWith("/login")) return;
      void navigateToLoginAfterSignOut();
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [sessionHint, isAuthenticated, online]);

  useEffect(() => {
    if (
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
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated || !user || multiBranchReady.current || bootstrapping.current) {
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
  }, [ensureProfile, isAuthenticated, online, user, router, pathname]);

  useEffect(() => {
    if (!online || !isAuthenticated || !user || user.needsProfile || !user.role) {
      return;
    }

    const HEARTBEAT_MS = 2 * 60_000;
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
  }, [heartbeat, isAuthenticated, online, user]);

  useEffect(() => {
    if (!user?.isPlatformAdmin || !user.userId) return;
    const next: PlatformOfflineSession = {
      userId: String(user.userId),
      name: user.name,
      email: user.email ?? null,
      hasTenantRole: Boolean(user.role),
      savedAt: Date.now(),
    };
    markPlatformOfflineSession(next);
  }, [user]);

  if (user?.isPlatformAdmin && user.userId) {
    const next: PlatformOfflineSession = {
      userId: String(user.userId),
      name: user.name,
      email: user.email ?? null,
      hasTenantRole: Boolean(user.role),
      savedAt: platformSession?.savedAt ?? 0,
    };
    if (
      platformSession?.userId !== next.userId ||
      platformSession.name !== next.name ||
      platformSession.email !== next.email ||
      platformSession.hasTenantRole !== next.hasTenantRole
    ) {
      setPlatformSession(next);
    }
  }

  const hintProfile = sessionHint ? shellProfileFromSessionHint(sessionHint) : null;
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
  const signingOut = hasExplicitLogout();
  const awaitingCloudReconnect = isAwaitingCloudReconnect({
    isAuthenticated,
    sessionHint,
  });
  const allowCachedShell =
    Boolean(resolvedCache) && !signingOut && (isAuthenticated || awaitingCloudReconnect);
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
    return <AppSplash label="Preparing workspace…" />;
  }

  if (signingOut) {
    return <AppSplash label="Signing out…" />;
  }

  if (
    !isAuthenticated &&
    online &&
    !cachedShellWhileOnlineHung &&
    !resolvedCache &&
    !awaitingCloudReconnect
  ) {
    return <AppSplash label="Redirecting to login…" />;
  }

  // No local shell while offline → send cashiers to email/password login
  // (device digest unlock), never a dead-end "Can't start while offline" card.
  if (
    cacheReady &&
    (!online || cachedShellWhileOnlineHung) &&
    !resolvedCache &&
    !resolvedPlatformSession
  ) {
    if (typeof window !== "undefined" && !pathname.startsWith("/login")) {
      const next = new URL("/login", window.location.origin);
      next.searchParams.set("fromBoot", "1");
      window.location.replace(`${next.pathname}${next.search}`);
    }
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
        <AppShellWithIdleLock userName={user?.name ?? resolvedPlatformSession?.name ?? null}>
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
    // Offline shell without JWT: stay off /login even if Dexie profile has not
    // settled yet — CloudReconnectBanner mounts once the shell paints below.
    if (awaitingCloudReconnect) {
      return <AppSplash label="Opening workspace…" />;
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

    if (onlineAuthBudgetElapsed && !resolvedCache && !resolvedPlatformSession) {
      return <AppSplash label="Redirecting to login…" />;
    }

    return <AppSplash label="Setting up your account…" />;
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
      <AppShellWithIdleLock userName={shellUser.name ?? null}>
        <OfflineProvider key={replicaKey}>
          <OfflineNavigationProvider>
            <OrganizationExperienceRoot>
              <ProductTourProvider
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
