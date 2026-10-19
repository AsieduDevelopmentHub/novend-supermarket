"use client";

import { useEffect, useState } from "react";
import type { AppRole } from "@/config/navigation";
import {
  loadShellProfile,
  type ShellProfile,
} from "@/lib/offline/shell-profile";
import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import { readMilliesSession } from "@/lib/offline/millies-auth";
import {
  hasStaffPermission,
  resolveStaffPermissions,
  type AppPermission,
} from "@/lib/offline/millies-permissions";
import { Id } from "@/convex/_generated/dataModel";

type CurrentUser = {
  name: string;
  role: AppRole;
  permissions: AppPermission[];
  branch: string | null;
  branchId: Id<"branches"> | null;
  imageUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  userId?: string;
  needsProfile?: boolean;
};

function shellToUser(profile: ShellProfile): CurrentUser {
  return {
    name: profile.name,
    role: profile.role,
    permissions: profile.permissions ?? resolveStaffPermissions(profile.role),
    branch: profile.branchName,
    branchId: profile.branchId as Id<"branches">,
    imageUrl: profile.imageUrl,
    email: profile.email,
    phone: profile.phone,
    userId: profile.userId,
    needsProfile: false,
  };
}

/** Millie's: identity from local PBKDF2 session + Dexie shell profile. */
export function useCurrentUser() {
  const [cached, setCached] = useState<ShellProfile | null>(null);
  const [cacheReady, setCacheReady] = useState(false);
  const session = typeof window !== "undefined" ? readMilliesSession() : null;

  useEffect(() => {
    let cancelled = false;
    void loadShellProfile().then((profile) => {
      if (cancelled) return;
      setCached(profile);
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fromSession: CurrentUser | null = session
    ? {
        name: session.displayName,
        role: session.role,
        permissions: session.permissions,
        branch: session.branchName,
        branchId: session.branchId as Id<"branches">,
        email: session.username.includes("@") ? session.username : null,
        userId: session.id,
        needsProfile: false,
      }
    : null;

  const user = hasExplicitLogout()
    ? null
    : cached
      ? shellToUser(cached)
      : fromSession;

  return {
    user,
    isLoading: !cacheReady && !fromSession,
    isAuthenticated: Boolean(user),
    needsProfile: false,
  };
}

export function usePermissions() {
  const { user, isLoading } = useCurrentUser();
  const role = (user?.role ?? undefined) as AppRole | undefined;
  const permissions =
    user?.permissions ?? (role ? resolveStaffPermissions(role) : []);

  return {
    isLoading,
    role,
    permissions,
    branchId: user?.branchId ?? null,
    branchName: user?.branch ?? null,
    isAdmin: role === "administrator",
    isManager: role === "manager",
    isCashier: role === "cashier",
    canManageProducts: hasStaffPermission(permissions, "products.manage"),
    canManageUsers: hasStaffPermission(permissions, "users.manage"),
    canManageBranches: hasStaffPermission(permissions, "branches.manage"),
    canManagePayroll: hasStaffPermission(permissions, "payroll.manage"),
    canViewStaffPerformance: hasStaffPermission(permissions, "staff.performance"),
    canDeactivateUsers: hasStaffPermission(permissions, "users.deactivate"),
    canViewCost: hasStaffPermission(permissions, "cost.view"),
    canTransferStock: hasStaffPermission(permissions, "stock.transfer"),
    canAccessSales: hasStaffPermission(permissions, "sales.access"),
    canProcessReturns: hasStaffPermission(permissions, "returns.process"),
    userId: user?.userId ?? null,
  };
}
