"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppSidebar, MobileSidebar } from "@/components/layout/app-sidebar";
import { NativeAppServices } from "@/components/layout/native-app-services";
import { AppSplash } from "@/features/auth/components/app-splash";
import type { AppRole } from "@/config/navigation";
import { OfflineProvider } from "@/providers/offline-provider";
import { OfflineNavigationProvider, OfflineOutlet } from "@/providers/offline-navigation";
import { OrganizationExperienceRoot } from "@/features/experience/components/organization-experience-root";
import {
  MilliesLicenseProvider,
  useMilliesLicense,
} from "@/providers/millies-license-provider";
import { MilliesLicenseGate } from "@/features/license/components/millies-license-gate";
import {
  clearMilliesSession,
  isMilliesSetupComplete,
  readMilliesSession,
  type MilliesSessionUser,
} from "@/lib/offline/millies-auth";
import { loadShellProfile, saveShellProfile, type ShellProfile } from "@/lib/offline/shell-profile";
import { bindOfflineOrganization } from "@/lib/offline/db";
import { MILLIES_LOCAL_ORG_ID } from "@/constants/runtime";
import { migrateMilliesSharedReplicaIfNeeded } from "@/lib/offline/millies-shared-replica";
import { syncMilliesStaffMirror } from "@/lib/offline/millies-users";
import { ensureDefaultSupermarketCategories } from "@/lib/offline/millies-default-categories";
import { CustomerDisplayServices } from "@/features/customer-display/components/customer-display-services";
import { MilliesTrialBanner } from "@/features/license/components/millies-trial-banner";
import { ProductTourProvider } from "@/features/tours/tour-provider";
import { FULLY_OFFLINE } from "@/constants/runtime";

/**
 * Fully offline Millie's shell — local PBKDF2 session, Chemist-style offline
 * license gate, and setupComplete. No Convex Auth, cloud device slots, or
 * reconnect UI.
 *
 * `/customer-display` is session-free: second window only mirrors cart via
 * localStorage / BroadcastChannel (same machine, no login required).
 */
export function MilliesAppLayoutClient({ children }: { children: ReactNode }) {
  return (
    <MilliesLicenseProvider>
      <MilliesAppLayoutInner>{children}</MilliesAppLayoutInner>
    </MilliesLicenseProvider>
  );
}

function MilliesAppLayoutInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isCustomerDisplayRoute = pathname === "/customer-display";
  const { ready: licenseReady, status: license } = useMilliesLicense();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<MilliesSessionUser | null>(null);
  const [profile, setProfile] = useState<ShellProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const setup = await isMilliesSetupComplete();
      if (cancelled) return;

      if (isCustomerDisplayRoute) {
        if (!setup) {
          router.replace("/login");
          return;
        }
        bindOfflineOrganization(MILLIES_LOCAL_ORG_ID);
        setReady(true);
        return;
      }

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
      await syncMilliesStaffMirror();
      await ensureDefaultSupermarketCategories();
      await saveShellProfile({
        userId: local.id,
        name: local.displayName,
        role: local.role,
        branchId: local.branchId,
        branchName: local.branchName,
        imageUrl: null,
        email: null,
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
  }, [router, pathname, isCustomerDisplayRoute]);

  if (isCustomerDisplayRoute) {
    if (!ready) {
      return <AppSplash label="Opening customer display…" showLabel />;
    }
    return (
      <NativeAppServices>
        <OfflineProvider key="millies-customer-display">
          <OfflineNavigationProvider>
            <OrganizationExperienceRoot>
              <main className="bg-background h-dvh min-h-0 overflow-hidden">
                <OfflineOutlet>{children}</OfflineOutlet>
              </main>
            </OrganizationExperienceRoot>
          </OfflineNavigationProvider>
        </OfflineProvider>
      </NativeAppServices>
    );
  }

  if (!licenseReady) {
    return <AppSplash label="Checking license…" showLabel />;
  }

  if (license && !license.allowed) {
    return <MilliesLicenseGate />;
  }

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

  const replicaKey = `${session.organizationId}:${session.id}`;

  return (
    <NativeAppServices>
      <OfflineProvider key={replicaKey}>
        <OfflineNavigationProvider>
          <OrganizationExperienceRoot>
            <ProductTourProvider
              enabled={FULLY_OFFLINE}
              identityKey={session.id}
              role={role}
              isPlatformAdmin={false}
            >
              <div className="bg-background flex h-dvh min-h-0 overflow-hidden">
                <AppSidebar user={shellUser} />
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  {/* Mobile hamburger only — store name lives in the navy sidebar. */}
                  <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 flex h-12 items-center gap-2 border-b px-3 backdrop-blur lg:hidden">
                    <MobileSidebar user={shellUser} />
                  </header>
                  <MilliesTrialBanner />
                  <main
                    data-tour="page-content"
                    data-novend-scroll-root
                    className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 lg:px-6 lg:py-4"
                  >
                    <OfflineOutlet>{children}</OfflineOutlet>
                  </main>
                </div>
              </div>
              <CustomerDisplayServices />
            </ProductTourProvider>
          </OrganizationExperienceRoot>
        </OfflineNavigationProvider>
      </OfflineProvider>
    </NativeAppServices>
  );
}
