"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { AppSidebar, MobileSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { NativeAppServices } from "@/components/layout/native-app-services";
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
import { markOfflineSession, readOfflineSession } from "@/lib/offline/session";
import { bindOfflineOrganization } from "@/lib/offline/db";
import { toUserMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const OFFLINE_AUTH_BUDGET_MS = 2000;

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
  const [cacheReady, setCacheReady] = useState(false);
  const [offlineAuthBudgetElapsed, setOfflineAuthBudgetElapsed] = useState(false);
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
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Only force login while online — offline refresh must use the cached session.
  useEffect(() => {
    if (!isLoading && !isAuthenticated && online) {
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
      router.replace("/platform");
      return;
    }
    if (user.needsOnboarding || user.needsProfile) {
      router.replace("/onboarding");
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
  }, [ensureProfile, isAuthenticated, online, user, router]);

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

  const shellFromCache =
    !online && cachedProfile
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
    (online && isLoading) ||
    (online && isAuthenticated && user === undefined) ||
    (!online && !cacheReady) ||
    (!online && isLoading && !cachedProfile && !offlineAuthBudgetElapsed);

  if (waitingForUser) {
    return <AppSplash label="Preparing workspace…" />;
  }

  if (!isAuthenticated && online) {
    return <AppSplash label="Redirecting to login…" />;
  }

  if (!online && !cachedProfile) {
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

  if (user?.isPlatformAdmin && (!user.role || pathname.startsWith("/platform"))) {
    return (
      <PlatformShell hasTenantRole={Boolean(user.role)}>{children}</PlatformShell>
    );
  }

  const liveReady = user && !user.needsProfile && user.role && (user.branch || user.branchId);

  if (!liveReady && !shellFromCache && !offlineSessionOk) {
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
      <OfflineProvider>
        <OfflineNavigationProvider>
          <div
            className={cn(
              "bg-background flex h-dvh max-h-dvh overflow-hidden overscroll-none",
              nativeShell && "native-shell",
            )}
          >
            {nativeShell ? null : <AppSidebar user={shellUser} />}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {nativeShell ? (
                <header className="border-border bg-card z-20 flex h-14 shrink-0 items-center gap-3 border-b px-5">
                  <Image
                    src={BRANDING.brandmark}
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 shrink-0 object-contain"
                  />
                  <p className="truncate text-base font-semibold">
                    {shellUser.organizationName?.trim() || APP_BRAND}
                  </p>
                </header>
              ) : (
                <header className="border-border bg-card z-20 flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:hidden">
                  <MobileSidebar user={shellUser} />
                  <Image
                    src={BRANDING.brandmark}
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 shrink-0 object-contain"
                  />
                  <p className="truncate text-base font-semibold">
                    {shellUser.organizationName?.trim() || APP_BRAND}
                  </p>
                </header>
              )}
              <LicenseBanner />
              <SyncStatusBanner />
              <main
                className={cn(
                  "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain",
                  nativeShell ? "px-5 py-5" : "px-4 py-6 lg:px-8",
                  nativeShell && "pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]",
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
