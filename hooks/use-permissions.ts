"use client";

import { useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AppRole } from "@/config/navigation";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  loadShellProfile,
  shellProfileFromSessionHint,
  type ShellProfile,
} from "@/lib/offline/shell-profile";
import { useOfflineSessionHint } from "@/hooks/use-offline-session-hint";
import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import { Id } from "@/convex/_generated/dataModel";

type CurrentUser = {
  name: string;
  role: AppRole;
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
    branch: profile.branchName,
    branchId: profile.branchId as Id<"branches">,
    imageUrl: profile.imageUrl,
    email: profile.email,
    phone: profile.phone,
    userId: profile.userId,
    needsProfile: false,
  };
}

export function useCurrentUser() {
  const { isAuthenticated } = useConvexAuth();
  const online = useConnectivity();
  const sessionHint = useOfflineSessionHint();
  // Skip Convex while offline or signed out so refresh never hangs on users.me
  // and logout never throws Unauthenticated in the app shell.
  const remote = useQuery(api.users.me, isAuthenticated && online ? {} : "skip");
  const [cached, setCached] = useState<ShellProfile | null>(null);
  const [cacheReady, setCacheReady] = useState(false);
  const [remoteBudgetElapsed, setRemoteBudgetElapsed] = useState(false);

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

  useEffect(() => {
    if (!online || !isAuthenticated || remote !== undefined) {
      queueMicrotask(() => setRemoteBudgetElapsed(false));
      return;
    }
    const timer = window.setTimeout(() => setRemoteBudgetElapsed(true), 2500);
    return () => window.clearTimeout(timer);
  }, [online, isAuthenticated, remote]);

  const readyRemote = remote && !remote.needsProfile && remote.role ? remote : null;
  const cachedUser = cached ? shellToUser(cached) : null;
  const hintProfile = sessionHint ? shellProfileFromSessionHint(sessionHint) : null;
  const hintUser =
    hintProfile &&
    (!cachedUser || cachedUser.userId === hintProfile.userId) &&
    (!readyRemote || String(readyRemote.userId) === hintProfile.userId)
      ? shellToUser(hintProfile)
      : null;
  const offlineUser = !online && (cachedUser ?? hintUser) ? (cachedUser ?? hintUser) : null;
  const liveUser = readyRemote as CurrentUser | null;
  const signingOut = hasExplicitLogout();
  // Prefer live when online. The login session hint is available before Convex
  // auth settles — using it avoids a cashier-shaped first paint for admins.
  const user = signingOut
    ? null
    : online
      ? (liveUser ?? cachedUser ?? hintUser)
      : (offlineUser ?? liveUser ?? hintUser);

  const waitingOnRemote =
    isAuthenticated &&
    remote === undefined &&
    online &&
    !remoteBudgetElapsed &&
    !cachedUser &&
    !hintUser;
  const waitingOnCache = !online && !cacheReady;

  return {
    user,
    isLoading: waitingOnRemote || waitingOnCache,
    isAuthenticated: Boolean(user || remote),
    needsProfile: Boolean(remote?.needsProfile),
  };
}

export function usePermissions() {
  const { user, isLoading } = useCurrentUser();
  const role = (user?.role ?? undefined) as AppRole | undefined;

  return {
    isLoading,
    role,
    branchId: user?.branchId ?? null,
    branchName: user?.branch ?? null,
    isAdmin: role === "administrator",
    isManager: role === "manager",
    isCashier: role === "cashier",
    canManageProducts: role === "administrator" || role === "manager",
    canManageUsers: role === "administrator" || role === "manager",
    canManageBranches: role === "administrator",
    canManagePayroll: role === "administrator",
    canViewStaffPerformance: role === "administrator" || role === "manager",
    canDeactivateUsers: role === "administrator" || role === "manager",
    canViewCost: role === "administrator" || role === "manager",
    canTransferStock: role === "administrator" || role === "manager",
    canAccessSales: role === "administrator" || role === "manager" || role === "cashier",
    canProcessReturns: role === "administrator" || role === "manager" || role === "cashier",
    userId: user?.userId ?? null,
  };
}
