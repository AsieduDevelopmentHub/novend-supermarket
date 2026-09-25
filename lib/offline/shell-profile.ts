import type { AppRole } from "@/config/navigation";
import { bindOfflineOrganization, getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";
import type { OfflineSessionHint } from "./session";

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
  organizationId: string | null;
};

function isAppRole(value: string | null): value is AppRole {
  return value === "administrator" || value === "manager" || value === "cashier";
}

/** Build a shell profile from the fast localStorage session hint (post-login). */
export function shellProfileFromSessionHint(hint: OfflineSessionHint): ShellProfile | null {
  if (!isAppRole(hint.role)) return null;
  return {
    userId: hint.userId,
    name: hint.name,
    role: hint.role,
    branchId: hint.branchId,
    branchName: hint.branchName || "Branch",
    imageUrl: null,
    email: hint.email ?? null,
    phone: null,
    organizationName: null,
    organizationId: hint.organizationId ?? null,
  };
}

/** Persist the signed-in shell profile into Dexie for offline remounts / navigation. */
export async function saveShellProfile(profile: ShellProfile): Promise<void> {
  if (profile.organizationId) {
    bindOfflineOrganization(profile.organizationId, profile.userId);
  }
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
    await setMeta(db, META_KEYS.profileOrganizationId, profile.organizationId ?? "");
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
    await setMeta(db, META_KEYS.profileOrganizationId, "");
  });
}

/** Load the last known shell profile from Dexie (null if incomplete). */
export async function loadShellProfile(): Promise<ShellProfile | null> {
  const db = await getOfflineDb();
  if (!db) return null;

  const [
    userId,
    name,
    role,
    branchId,
    branchName,
    imageUrl,
    email,
    phone,
    organizationName,
    organizationId,
  ] = await Promise.all([
    getMeta(db, META_KEYS.profileUserId),
    getMeta(db, META_KEYS.profileName),
    getMeta(db, META_KEYS.profileRole),
    getMeta(db, META_KEYS.profileBranchId),
    getMeta(db, META_KEYS.profileBranchName),
    getMeta(db, META_KEYS.profileImageUrl),
    getMeta(db, META_KEYS.profileEmail),
    getMeta(db, META_KEYS.profilePhone),
    getMeta(db, META_KEYS.profileOrganizationName),
    getMeta(db, META_KEYS.profileOrganizationId),
  ]);

  if (!userId || !name || !isAppRole(role) || !branchId) {
    return null;
  }

  if (organizationId) {
    bindOfflineOrganization(organizationId, userId);
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
    organizationId: organizationId ? organizationId : null,
  };
}
