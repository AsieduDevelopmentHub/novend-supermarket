"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppSidebar, MobileSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { NativeAppServices } from "@/components/layout/native-app-services";
import { AppSplash } from "@/features/auth/components/app-splash";
import type { AppRole } from "@/config/navigation";
import { SyncStatusHeaderButton } from "@/components/offline/sync-status-chip";
import { OfflineProvider } from "@/providers/offline-provider";
import { OfflineNavigationProvider, OfflineOutlet } from "@/providers/offline-navigation";
import { OrganizationExperienceRoot } from "@/features/experience/components/organization-experience-root";
import {
  clearMilliesSession,
  isMilliesSetupComplete,
  readMilliesSession,
  type MilliesSessionUser,
} from "@/lib/offline/millies-auth";
import { loadShellProfile, saveShellProfile, type ShellProfile } from "@/lib/offline/shell-profile";
import { bindOfflineOrganization } from "@/lib/offline/db";
import { migrateMilliesSharedReplicaIfNeeded } from "@/lib/offline/millies-shared-replica";
import { CustomerDisplayServices } from "@/features/customer-display/components/customer-display-services";

/**
 * Fully offline Millie's shell — gates on local PBKDF2 session + setupComplete.
 * No Convex Auth, device activation, or cloud reconnect UI.
 */
export function MilliesAppLayoutClient({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<MilliesSessionUser | null>(null);
  const [profile, setProfile] = useState<ShellProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const setup = await isMilliesSetupComplete();
      if (cancelled) return;
      if (!setup) {
        router.replace("/login");
        return;
      }
      const local = readMilliesSession();
      if (!local) {
        clearMilliesSession();
        router.replace("/login");
        return;
      }
      bindOfflineOrganization(local.organizationId);
      await migrateMilliesSharedReplicaIfNeeded();
      // Shared replica meta can lag behind the PBKDF2 session — always stamp shell.
      await saveShellProfile({
        userId: local.id,
        name: local.displayName,
        role: local.role,
        branchId: local.branchId,
        branchName: local.branchName,
        imageUrl: null,
        email: local.username.includes("@") ? local.username : null,
        phone: null,
        organizationName: "Millie's Supermarket",
        organizationId: local.organizationId,
      });
      const shell = await loadShellProfile();
      if (cancelled) return;
      setSession(local);
      setProfile(shell);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (!ready || !session) {
    return <AppSplash label="Opening workspace…" showLabel />;
  }

  const role = (profile?.role ?? session.role) as AppRole;
  const shellUser = {
    name: profile?.name ?? session.displayName,
    role,
    branch: profile?.branchName ?? session.branchName,
    imageUrl: profile?.imageUrl ?? null,
    organizationName: profile?.organizationName ?? null,
    isPlatformAdmin: false,
  };

  const isCustomerDisplayRoute = pathname === "/customer-display";
  const replicaKey = `${session.organizationId}:${session.id}`;

  return (
    <NativeAppServices>
      <OfflineProvider key={replicaKey}>
        <OfflineNavigationProvider>
          <OrganizationExperienceRoot>
            <div className="bg-background flex h-dvh min-h-0 overflow-hidden">
              {!isCustomerDisplayRoute ? <AppSidebar user={shellUser} /> : null}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {!isCustomerDisplayRoute ? (
                  <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 flex h-12 items-center gap-2 border-b px-3 backdrop-blur md:px-4">
                    <MobileSidebar user={shellUser} />
                    <div className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
                      {shellUser.organizationName ?? "Millie's"} · {shellUser.branch}
                    </div>
                    <SyncStatusHeaderButton />
                  </header>
                ) : null}
                <main className="min-h-0 flex-1 overflow-y-auto">
                  <OfflineOutlet>{children}</OfflineOutlet>
                </main>
                {!isCustomerDisplayRoute ? <MobileBottomNav /> : null}
              </div>
            </div>
            <CustomerDisplayServices />
          </OrganizationExperienceRoot>
        </OfflineNavigationProvider>
      </OfflineProvider>
    </NativeAppServices>
  );
}
