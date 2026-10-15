/**
 * Mirror Millie's localUsers into the shared org Dexie `users` table so
 * UsersView / payroll / sales attribution see the same staff list.
 */

import {
  createLocalUser,
  readMilliesSession,
  resetLocalUserPassword,
  setLocalUserActive,
} from "@/lib/offline/millies-auth";
import type { MilliesLocalRole } from "@/lib/offline/millies-auth-db";
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
  phone?: string;
}) {
  const created = await createLocalUser({
    username: input.username,
    displayName: input.displayName,
    password: input.password,
    role: input.role,
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
  phone?: string;
  active: boolean;
}) {
  const session = readMilliesSession();
  if (!session) throw new Error("Sign in required");
  if (input.id !== session.id) {
    await setLocalUserActive(input.id, input.active, session);
  } else if (!input.active) {
    throw new Error("You cannot deactivate your own account");
  }
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage unavailable");
  const authDb = await import("@/lib/offline/millies-auth-db").then((m) => m.getMilliesAuthDb());
  if (!authDb) throw new Error("Local storage unavailable");
  const row = await authDb.localUsers.get(input.id);
  if (!row) throw new Error("User not found");
  const now = Date.now();
  await authDb.localUsers.put({
    ...row,
    displayName: input.displayName.trim() || row.displayName,
    role: input.role,
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
