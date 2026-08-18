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

  const readyRemote = remote && !remote.needsProfile && remote.role ? remote : null;
  const offlineUser = !online && cached ? shellToUser(cached) : null;
  // Prefer live when online; always fall back to Dexie cache offline.
  const user = online
    ? ((readyRemote as CurrentUser | null) ?? null)
    : (offlineUser ?? (readyRemote as CurrentUser | null));

  const waitingOnRemote = remote === undefined && online;
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
  };
}
