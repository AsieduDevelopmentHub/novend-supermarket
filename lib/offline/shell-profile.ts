import type { AppRole } from "@/config/navigation";
import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";

/** Cached authenticated shell identity for offline boot and permissions. */
export type ShellProfile = {
  userId: string;
  name: string;
  role: AppRole;
  branchId: string;
  branchName: string;
  imageUrl: string | null;
  email: string | null;
  phone: string | null;
  organizationName: string | null;
};

function isAppRole(value: string | null): value is AppRole {
  return value === "administrator" || value === "manager" || value === "cashier";
}

/** Persist the signed-in shell profile into Dexie for offline remounts / navigation. */
export async function saveShellProfile(profile: ShellProfile): Promise<void> {
  const db = await getOfflineDb();
  if (!db) return;
  await db.transaction("rw", db.meta, async () => {
    await setMeta(db, META_KEYS.profileUserId, profile.userId);
    await setMeta(db, META_KEYS.profileName, profile.name);
    await setMeta(db, META_KEYS.profileRole, profile.role);
    await setMeta(db, META_KEYS.profileBranchId, profile.branchId);
    await setMeta(db, META_KEYS.profileBranchName, profile.branchName);
    await setMeta(db, META_KEYS.profileImageUrl, profile.imageUrl ?? "");
    await setMeta(db, META_KEYS.profileEmail, profile.email ?? "");
    await setMeta(db, META_KEYS.profilePhone, profile.phone ?? "");
    await setMeta(db, META_KEYS.profileOrganizationName, profile.organizationName ?? "");
  });
}

/** Remove cached shell identity (call on sign-out). */
export async function clearShellProfile(): Promise<void> {
  const db = await getOfflineDb();
  if (!db) return;
  await db.transaction("rw", db.meta, async () => {
    await setMeta(db, META_KEYS.profileUserId, "");
    await setMeta(db, META_KEYS.profileName, "");
    await setMeta(db, META_KEYS.profileRole, "");
    await setMeta(db, META_KEYS.profileBranchId, "");
    await setMeta(db, META_KEYS.profileBranchName, "");
    await setMeta(db, META_KEYS.profileImageUrl, "");
    await setMeta(db, META_KEYS.profileEmail, "");
    await setMeta(db, META_KEYS.profilePhone, "");
    await setMeta(db, META_KEYS.profileOrganizationName, "");
  });
}

/** Load the last known shell profile from Dexie (null if incomplete). */
export async function loadShellProfile(): Promise<ShellProfile | null> {
  const db = await getOfflineDb();
  if (!db) return null;

  const [userId, name, role, branchId, branchName, imageUrl, email, phone, organizationName] =
    await Promise.all([
    getMeta(db, META_KEYS.profileUserId),
    getMeta(db, META_KEYS.profileName),
    getMeta(db, META_KEYS.profileRole),
    getMeta(db, META_KEYS.profileBranchId),
    getMeta(db, META_KEYS.profileBranchName),
    getMeta(db, META_KEYS.profileImageUrl),
    getMeta(db, META_KEYS.profileEmail),
    getMeta(db, META_KEYS.profilePhone),
    getMeta(db, META_KEYS.profileOrganizationName),
  ]);

  if (!userId || !name || !isAppRole(role) || !branchId) {
    return null;
  }

  return {
    userId,
    name,
    role,
    branchId,
    branchName: branchName || "Branch",
    imageUrl: imageUrl ? imageUrl : null,
    email: email ? email : null,
    phone: phone ? phone : null,
    organizationName: organizationName ? organizationName : null,
  };
}
