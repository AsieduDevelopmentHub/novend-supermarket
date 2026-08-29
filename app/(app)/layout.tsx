"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { SyncCenterDialog } from "@/components/offline/sync-center-dialog";
import { LicenseBanner } from "@/features/billing/components/license-banner";
import { DeviceActivationGate } from "@/features/billing/components/device-activation-gate";
import { InstallPromptDialog } from "@/components/install-prompt-dialog";
import { OfflineProvider } from "@/providers/offline-provider";
import { OfflineNavigationProvider, OfflineOutlet } from "@/providers/offline-navigation";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useNativeShell } from "@/hooks/use-native-shell";
import { loadShellProfile, saveShellProfile, type ShellProfile } from "@/lib/offline/shell-profile";
import { markOfflineSession, readOfflineSession, hasOfflineSession } from "@/lib/offline/session";
import {
  bindPlatformOfflineDb,
  markPlatformOfflineSession,
  readPlatformOfflineSession,
  type PlatformOfflineSession,
} from "@/lib/offline/platform-cache";
import { bindOfflineOrganization } from "@/lib/offline/db";
import { toUserMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const OFFLINE_AUTH_BUDGET_MS = 1200;
/** Cap/Web often look "online" while Convex never settles — fail soft into cache/login. */
const ONLINE_AUTH_BUDGET_MS = 4500;

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
  useEffect(() => {
    let cancelled = false;
    void loadShellProfile().then((profile) => {
      if (cancelled) return;
      if (profile) {
        setCachedProfile(profile);
        markOfflineSession({
          userId: profile.userId,
          name: profile.name,
          role: profile.role,
          branchId: profile.branchId,
          branchName: profile.branchName,
          organizationId: profile.organizationId ?? undefined,
          savedAt: Date.now(),
        });
      } else {
        // Fast path while Dexie catches up — localStorage hint from last online session.
        const hint = readOfflineSession();
        if (
          hint &&
          (hint.role === "administrator" || hint.role === "manager" || hint.role === "cashier")
        ) {
          setCachedProfile({
            userId: hint.userId,
            name: hint.name,
            role: hint.role,
            branchId: hint.branchId,
            branchName: hint.branchName || "Branch",
            imageUrl: null,
            email: null,
            phone: null,
            organizationName: null,
            organizationId: hint.organizationId ?? null,
          });
        }
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

  // Only force login while online and there is no local offline session.
  // Cap often flickers "online" without a Convex token — never kick a cached cashier out.
  useEffect(() => {
    if (!isLoading && !isAuthenticated && online && !hasOfflineSession()) {
      router.replace("/login");
      multiBranchReady.current = false;
    }
  }, [isAuthenticated, isLoading, online, router]);

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

  useEffect(() => {
    if (!online) {
      queueMicrotask(() => setOnlineAuthBudgetElapsed(false));
      return;
    }
    if (!isLoading && !(isAuthenticated && user === undefined)) {
      queueMicrotask(() => setOnlineAuthBudgetElapsed(false));
      return;
    }
    const timer = window.setTimeout(() => setOnlineAuthBudgetElapsed(true), ONLINE_AUTH_BUDGET_MS);
    return () => window.clearTimeout(timer);
  }, [online, isLoading, isAuthenticated, user]);

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

    const device = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : undefined;
    void heartbeat({ device });
    const interval = window.setInterval(() => {
      void heartbeat({ device });
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [heartbeat, isAuthenticated, online, user]);

  useEffect(() => {
    if (!user?.isPlatformAdmin || !user.userId) return;
    markPlatformOfflineSession({
      userId: String(user.userId),
      name: user.name,
      email: user.email ?? null,
      hasTenantRole: Boolean(user.role),
      savedAt: Date.now(),
    });
  }, [user]);

  // Keep the in-memory fallback in step with the live session (sanctioned
  // "adjust state during render" pattern — avoids a redundant effect).
  if (
    user?.isPlatformAdmin &&
    user.userId &&
    (!platformSession ||
      platformSession.userId !== String(user.userId) ||
      platformSession.name !== user.name ||
      platformSession.email !== (user.email ?? null) ||
      platformSession.hasTenantRole !== Boolean(user.role))
  ) {
    setPlatformSession({
      userId: String(user.userId),
      name: user.name,
      email: user.email ?? null,
      hasTenantRole: Boolean(user.role),
      savedAt: platformSession?.savedAt ?? 0,
    });
  }

  // Keep Dexie bound to the platform replica on Super Admin routes, otherwise the tenant org.
  // Bind during render (before OfflineProvider children effects) so the first snapshot
  // targets the correct org DB — not novend-offline-anon.
  if (user?.userId) {
    if (pathname.startsWith("/platform") && user.isPlatformAdmin) {
      bindPlatformOfflineDb(String(user.userId));
    } else if ("organizationId" in user && user.organizationId) {
      bindOfflineOrganization(String(user.organizationId), String(user.userId));
    }
  }

  const replicaKey =
    user?.userId && pathname.startsWith("/platform") && user.isPlatformAdmin
      ? `platform-${user.userId}`
      : user?.userId && "organizationId" in user && user.organizationId
        ? `org-${user.organizationId}-${user.userId}`
        : "anon";

  /** Stale-looking online (Convex hung) but we have a local shell — treat like offline session. */
  const cachedShellWhileOnlineHung =
    online &&
    onlineAuthBudgetElapsed &&
    Boolean(cachedProfile) &&
    (isLoading || (isAuthenticated && user === undefined));

  const shellFromCache =
    (!online || cachedShellWhileOnlineHung) && cachedProfile
      ? {
          name: cachedProfile.name,
          role: cachedProfile.role,
          branch: cachedProfile.branchName,
          imageUrl: cachedProfile.imageUrl,
          organizationName: cachedProfile.organizationName,
        }
      : null;

  const offlineSessionOk =
    !online &&
    Boolean(cachedProfile) &&
    (isAuthenticated || offlineAuthBudgetElapsed || !isLoading);

  const waitingForUser =
    !cachedProfile &&
    !platformSession &&
    ((online && isLoading && !onlineAuthBudgetElapsed) ||
      (online && isAuthenticated && user === undefined && !onlineAuthBudgetElapsed) ||
      (!online && !cacheReady) ||
      (!online && isLoading && !offlineAuthBudgetElapsed));

  if (waitingForUser) {
    return <AppSplash label="Preparing workspace…" />;
  }

  if (!isAuthenticated && online && !cachedShellWhileOnlineHung) {
    return <AppSplash label="Redirecting to login…" />;
  }

  if ((!online || cachedShellWhileOnlineHung) && !cachedProfile && !platformSession) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <ErrorState
          title="Can't start while offline"
          message="Sign in while online once so this device can keep working offline after a refresh."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  const isPlatformRoute = pathname.startsWith("/platform");
  const platformAdminOnly = Boolean(user?.isPlatformAdmin) && !user?.role;

  if (platformAdminOnly && !isPlatformRoute) {
    return <AppSplash label="Opening platform…" />;
  }

  const showPlatformShell =
    (Boolean(user?.isPlatformAdmin) && (!user?.role || isPlatformRoute)) ||
    (!online && isPlatformRoute && Boolean(platformSession));

  if (showPlatformShell) {
    return (
      <NativeAppServices>
        <OfflineProvider key={replicaKey}>
          <OfflineNavigationProvider>
            <RestoreLastRoute />
            <PlatformShell
              hasTenantRole={Boolean(user?.role ?? platformSession?.hasTenantRole)}
              sessionName={user?.name ?? platformSession?.name}
              sessionEmail={user?.email ?? platformSession?.email ?? null}
            >
              <OfflineOutlet>{children}</OfflineOutlet>
            </PlatformShell>
          </OfflineNavigationProvider>
        </OfflineProvider>
      </NativeAppServices>
    );
  }

  const liveReady = user && !user.needsProfile && user.role && (user.branch || user.branchId);

  if (!liveReady && !shellFromCache && !offlineSessionOk && !cachedShellWhileOnlineHung) {
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

  return (
    <NativeAppServices>
      <OfflineProvider key={replicaKey}>
        <OfflineNavigationProvider>
          <RestoreLastRoute />
          <div
            className={cn(
              "bg-background flex h-dvh max-h-dvh overflow-hidden overscroll-none",
              nativeShell && "native-shell",
            )}
          >
            {nativeShell ? null : <AppSidebar user={shellUser} />}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {nativeShell ? <div className="native-status-bar" aria-hidden /> : null}
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
                  <p className="truncate text-base font-semibold">
                    {shellUser.organizationName?.trim() || APP_BRAND}
                  </p>
                </header>
              )}
              <LicenseBanner />
              <SyncStatusBanner />
              {nativeShell ? (
                <div id="native-page-header-host" className="native-page-header-host shrink-0" />
              ) : null}
              <main
                data-novend-scroll-root
                className={cn(
                  "min-h-0 min-w-0 flex-1 overscroll-y-contain",
                  nativeShell
                    ? "overflow-x-clip overflow-y-auto px-[var(--mobile-page-pad)] pt-3 pb-5"
                    : "overflow-x-hidden overflow-y-auto px-4 py-6 lg:px-8",
                  nativeShell && "pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))]",
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
        </OfflineNavigationProvider>
      </OfflineProvider>
    </NativeAppServices>
  );
}
