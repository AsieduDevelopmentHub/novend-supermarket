"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AppRole } from "@/config/navigation";
import { useConnectivity } from "@/hooks/use-connectivity";
import { loadShellProfile, type ShellProfile } from "@/lib/offline/shell-profile";
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
  const online = useConnectivity();
  // Skip Convex while offline so refresh never hangs on users.me.
  const remote = useQuery(api.users.me, online ? {} : "skip");
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
    if (!online || remote !== undefined) {
      queueMicrotask(() => setRemoteBudgetElapsed(false));
      return;
    }
    const timer = window.setTimeout(() => setRemoteBudgetElapsed(true), 2500);
    return () => window.clearTimeout(timer);
  }, [online, remote]);

  const readyRemote = remote && !remote.needsProfile && remote.role ? remote : null;
  const cachedUser = cached ? shellToUser(cached) : null;
  const offlineUser = !online && cachedUser ? cachedUser : null;
  const liveUser = readyRemote as CurrentUser | null;
  // Prefer live when online; fall back to Dexie after a short hang so Capacitor
  // does not block Settings/More on a stuck Convex subscription.
  const user = online
    ? (liveUser ?? (remoteBudgetElapsed ? cachedUser : null))
    : (offlineUser ?? liveUser);

  const waitingOnRemote = remote === undefined && online && !remoteBudgetElapsed;
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
    canViewCost: role === "administrator" || role === "manager",
    canTransferStock: role === "administrator" || role === "manager",
    canAccessSales: role === "administrator" || role === "manager" || role === "cashier",
    canProcessReturns: role === "administrator" || role === "manager" || role === "cashier",
    userId: user?.userId ?? null,
  };
}
