/**
 * Mirror Millie's localUsers into the shared org Dexie `users` table so
 * UsersView / payroll / sales attribution see the same staff list.
 */

import {
  createLocalUser,
  readMilliesSession,
  resetLocalUserPassword,
  setLocalUserActive,
  writeMilliesSession,
} from "@/lib/offline/millies-auth";
import type { MilliesLocalRole } from "@/lib/offline/millies-auth-db";
import { getMilliesAuthDb } from "@/lib/offline/millies-auth-db";
import {
  assertCanAssignStaffRole,
  assertCanGrantStaffPermissions,
  assertCanManageStaff,
  hasStaffPermission,
  normalizePermissionList,
  permissionsForRole,
  resolveStaffPermissions,
  type AppPermission,
} from "@/lib/offline/millies-permissions";
import { bindOfflineOrganization, getOfflineDb } from "@/lib/offline/db";
import { notifyReplicaChanged } from "@/lib/offline/replica-events";
import type { MirroredUser } from "@/lib/offline/types";

async function mirrorUser(row: {
  id: string;
  username: string;
  displayName: string;
  role: MilliesLocalRole;
  active: boolean;
  phone?: string | null;
}) {
  const session = readMilliesSession();
  if (!session) throw new Error("Sign in as an administrator to manage staff");
  bindOfflineOrganization(session.organizationId);
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage unavailable");
  const existing = await db.users.get(row.id);
  const mirrored: MirroredUser = {
    id: row.id,
    userId: row.id,
    name: row.displayName,
    role: row.role,
    branch: session.branchName,
    branchId: session.branchId,
    phone: row.phone ?? existing?.phone ?? null,
    status: row.active ? "active" : "inactive",
    email: row.username.includes("@") ? row.username : null,
    imageUrl: existing?.imageUrl ?? null,
    isOwner: row.role === "administrator",
    isSelf: row.id === session.id,
    lastSeenAt: existing?.lastSeenAt ?? null,
    lastLoginAt: existing?.lastLoginAt ?? null,
    lastDevice: existing?.lastDevice ?? null,
  };
  await db.users.put(mirrored);
  notifyReplicaChanged();
  return mirrored;
}

export async function milliesCreateStaff(input: {
  username: string;
  displayName: string;
  password: string;
  role: MilliesLocalRole;
  permissions?: readonly AppPermission[] | null;
  phone?: string;
}) {
  const session = readMilliesSession();
  if (!session) throw new Error("Sign in required");
  assertCanManageStaff(session.role);
  if (!hasStaffPermission(session.permissions, "users.manage")) {
    throw new Error("You do not have permission to create staff");
  }
  const permissions =
    normalizePermissionList(input.permissions) ?? permissionsForRole(input.role);
  assertCanGrantStaffPermissions(session.role, session.permissions, input.role, permissions);

  const created = await createLocalUser({
    username: input.username,
    displayName: input.displayName,
    password: input.password,
    role: input.role,
    permissions,
  });
  await mirrorUser({
    id: created.id,
    username: created.username,
    displayName: created.displayName,
    role: created.role,
    active: true,
    phone: input.phone ?? null,
  });
  return created;
}

export async function milliesUpdateStaff(input: {
  id: string;
  displayName: string;
  role: MilliesLocalRole;
  permissions?: readonly AppPermission[] | null;
  phone?: string;
  active: boolean;
}) {
  const session = readMilliesSession();
  if (!session) throw new Error("Sign in required");
  assertCanManageStaff(session.role);
  if (!hasStaffPermission(session.permissions, "users.manage")) {
    throw new Error("You do not have permission to edit staff");
  }
  assertCanAssignStaffRole(session.role, input.role);

  const permissions =
    normalizePermissionList(input.permissions) ?? permissionsForRole(input.role);
  assertCanGrantStaffPermissions(session.role, session.permissions, input.role, permissions);

  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage unavailable");
  const authDb = await getMilliesAuthDb();
  if (!authDb) throw new Error("Local storage unavailable");
  const row = await authDb.localUsers.get(input.id);
  if (!row) throw new Error("User not found");
  if (input.id === session.id && !input.active) {
    throw new Error("You cannot deactivate your own account");
  }
  if (input.id !== session.id && row.active !== input.active) {
    await setLocalUserActive(input.id, input.active, session);
  }
  const now = Date.now();
  await authDb.localUsers.put({
    ...row,
    displayName: input.displayName.trim() || row.displayName,
    role: input.role,
    permissions,
    active: input.active,
    updatedAt: now,
  });
  await mirrorUser({
    id: input.id,
    username: row.username,
    displayName: input.displayName.trim() || row.displayName,
    role: input.role,
    active: input.active,
    phone: input.phone ?? null,
  });

  // Keep the signed-in session in sync when editing yourself.
  if (input.id === session.id) {
    writeMilliesSession({
      ...session,
      displayName: input.displayName.trim() || row.displayName,
      role: input.role,
      permissions: resolveStaffPermissions(input.role, permissions),
    });
  }
}

export async function milliesGetStaffPermissions(userId: string): Promise<AppPermission[]> {
  const authDb = await getMilliesAuthDb();
  if (!authDb) return [];
  const row = await authDb.localUsers.get(userId);
  if (!row) return [];
  return resolveStaffPermissions(row.role, row.permissions);
}

export async function milliesResetStaffPassword(userId: string, password: string) {
  const session = readMilliesSession();
  if (!session) throw new Error("Sign in required");
  await resetLocalUserPassword(userId, password, session);
}

/** Ensure every localUsers row exists in the shared org `users` mirror. */
export async function syncMilliesStaffMirror() {
  const session = readMilliesSession();
  if (!session) return;
  bindOfflineOrganization(session.organizationId);
  const { listLocalUsers } = await import("@/lib/offline/millies-auth");
  const rows = await listLocalUsers();
  for (const row of rows) {
    await mirrorUser({
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      role: row.role,
      active: row.active,
    });
  }
}
