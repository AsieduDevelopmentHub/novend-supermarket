/**
 * Millie's local authority: Dexie users + PBKDF2 session.
 * No Convex Auth — setup and login work with zero network.
 */

import {
  MILLIES_LOCAL_BRANCH_ID,
  MILLIES_LOCAL_BRANCH_NAME,
  MILLIES_LOCAL_ORG_ID,
} from "@/constants/runtime";
import { APP_BRAND } from "@/constants/app";
import {
  formatRecoveryKeyForDisplay,
  generateRecoveryKey,
  sealRecoveryKey,
} from "@/lib/offline/recovery-key";
import { hashPassword, verifyPassword } from "./millies-auth-crypto";
import {
  getAuthMeta,
  getMilliesAuthDb,
  isMilliesSetupComplete,
  MILLIES_AUTH_META,
  setAuthMeta,
  type MilliesLocalRole,
  type MilliesLocalUser,
} from "./millies-auth-db";
import { bootstrapMilliesStore } from "./millies-bootstrap";

const SESSION_KEY = "millies.localSession";
/** Cookie so Edge middleware allows app routes without a Convex JWT. */
export const MILLIES_LOCAL_SESSION_COOKIE = "millies_local_session";

export type MilliesSessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: MilliesLocalRole;
  branchId: string;
  branchName: string;
  organizationId: string;
};

function createId(prefix: string) {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${uuid.replace(/-/g, "").slice(0, 16)}`;
}

function setSessionCookie(active: boolean) {
  if (typeof document === "undefined") return;
  if (active) {
    document.cookie = `${MILLIES_LOCAL_SESSION_COOKIE}=1; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 400}`;
  } else {
    document.cookie = `${MILLIES_LOCAL_SESSION_COOKIE}=; path=/; Max-Age=0`;
  }
}

export function readMilliesSession(): MilliesSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MilliesSessionUser;
    if (!parsed?.id || !parsed?.role || !parsed?.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeMilliesSession(user: MilliesSessionUser): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  setSessionCookie(true);
}

export function clearMilliesSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
  setSessionCookie(false);
}

export function hasMilliesSession(): boolean {
  return Boolean(readMilliesSession());
}

async function requireAuthDb() {
  const db = await getMilliesAuthDb();
  if (!db) throw new Error("Local storage unavailable on this device");
  return db;
}

export async function createLocalUser(input: {
  username: string;
  displayName: string;
  password: string;
  role: MilliesLocalRole;
}): Promise<MilliesSessionUser> {
  const db = await requireAuthDb();
  const username = input.username.trim().toLowerCase();
  if (!username || input.password.length < 6) {
    throw new Error("Username required and password must be at least 6 characters");
  }
  const existing = await db.localUsers.where("username").equals(username).first();
  if (existing) throw new Error("Username already exists");

  const { salt, hash, iterations } = await hashPassword(input.password);
  const now = Date.now();
  const id = createId("usr");
  const branchId = (await getAuthMeta(MILLIES_AUTH_META.branchId)) ?? MILLIES_LOCAL_BRANCH_ID;
  const branchName =
    (await getAuthMeta(MILLIES_AUTH_META.branchName)) ?? MILLIES_LOCAL_BRANCH_NAME;
  const organizationId =
    (await getAuthMeta(MILLIES_AUTH_META.organizationId)) ?? MILLIES_LOCAL_ORG_ID;

  const row: MilliesLocalUser = {
    id,
    username,
    displayName: input.displayName.trim() || username,
    role: input.role,
    salt,
    passwordHash: hash,
    iterations,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  await db.localUsers.add(row);

  return {
    id,
    username,
    displayName: row.displayName,
    role: input.role,
    branchId,
    branchName,
    organizationId,
  };
}

export async function milliesLogin(
  username: string,
  password: string,
): Promise<MilliesSessionUser> {
  const db = await requireAuthDb();
  const normalized = username.trim().toLowerCase();
  const user = await db.localUsers.where("username").equals(normalized).first();
  if (!user || !user.active) throw new Error("Invalid username or password");
  const ok = await verifyPassword(password, user.salt, user.passwordHash, user.iterations);
  if (!ok) throw new Error("Invalid username or password");

  const branchId = (await getAuthMeta(MILLIES_AUTH_META.branchId)) ?? MILLIES_LOCAL_BRANCH_ID;
  const branchName =
    (await getAuthMeta(MILLIES_AUTH_META.branchName)) ?? MILLIES_LOCAL_BRANCH_NAME;
  const organizationId =
    (await getAuthMeta(MILLIES_AUTH_META.organizationId)) ?? MILLIES_LOCAL_ORG_ID;

  const session: MilliesSessionUser = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    branchId,
    branchName,
    organizationId,
  };
  writeMilliesSession(session);
  await bootstrapMilliesStore({
    organizationId,
    branchId,
    branchName,
    storeName: (await getAuthMeta(MILLIES_AUTH_META.storeName)) ?? APP_BRAND,
    session,
  });
  // Existing tills that never started a trial (pre-auto-start builds) get one on login.
  const { startLicenseTrial } = await import("@/lib/millies-license");
  await startLicenseTrial();
  return session;
}

export async function milliesLogout(): Promise<void> {
  clearMilliesSession();
}

export async function listLocalUsers(): Promise<
  Array<{
    id: string;
    username: string;
    displayName: string;
    role: MilliesLocalRole;
    active: boolean;
    createdAt: number;
  }>
> {
  const db = await getMilliesAuthDb();
  if (!db) return [];
  // createdAt is not indexed on millies-auth-v1 — sort in memory.
  const rows = await db.localUsers.toArray();
  rows.sort((a, b) => a.createdAt - b.createdAt);
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    active: row.active,
    createdAt: row.createdAt,
  }));
}

export async function setLocalUserActive(
  userId: string,
  active: boolean,
  actor: MilliesSessionUser,
): Promise<void> {
  if (actor.role !== "administrator" && actor.role !== "manager") {
    throw new Error("Only administrators or managers can change users");
  }
  const db = await requireAuthDb();
  const target = await db.localUsers.get(userId);
  if (!target) throw new Error("User not found");
  if (target.id === actor.id && !active) {
    throw new Error("You cannot deactivate your own account");
  }
  if (!active && target.role === "administrator") {
    const activeAdmins = await db.localUsers
      .filter((u) => u.role === "administrator" && u.active && u.id !== userId)
      .count();
    if (activeAdmins === 0) {
      throw new Error("Cannot deactivate the last active administrator");
    }
  }
  if (actor.role === "manager" && target.role !== "cashier") {
    throw new Error("Managers can only change cashiers");
  }
  await db.localUsers.update(userId, { active, updatedAt: Date.now() });
}

export async function resetLocalUserPassword(
  userId: string,
  newPassword: string,
  actor: MilliesSessionUser,
): Promise<void> {
  if (actor.role !== "administrator" && actor.role !== "manager") {
    throw new Error("Only administrators or managers can reset passwords");
  }
  if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");
  const db = await requireAuthDb();
  const target = await db.localUsers.get(userId);
  if (!target) throw new Error("User not found");
  if (actor.role === "manager" && target.role !== "cashier") {
    throw new Error("Managers can only reset cashier passwords");
  }
  const { salt, hash, iterations } = await hashPassword(newPassword);
  await db.localUsers.update(userId, {
    salt,
    passwordHash: hash,
    iterations,
    updatedAt: Date.now(),
  });
}

export async function verifyMilliesUserPassword(
  userId: string,
  password: string,
): Promise<boolean> {
  const db = await getMilliesAuthDb();
  if (!db) return false;
  const user = await db.localUsers.get(userId);
  if (!user || !user.active) return false;
  return verifyPassword(password, user.salt, user.passwordHash, user.iterations);
}

export type MilliesSetupInput = {
  storeName: string;
  phone?: string;
  address?: string;
  adminUsername: string;
  adminDisplayName: string;
  adminPassword: string;
};

export async function completeMilliesSetup(input: MilliesSetupInput): Promise<{
  session: MilliesSessionUser;
  recoveryKeyDisplay: string;
}> {
  if (await isMilliesSetupComplete()) {
    throw new Error("Setup already completed");
  }
  const name = input.storeName.trim() || APP_BRAND;
  const organizationId = MILLIES_LOCAL_ORG_ID;
  const branchId = MILLIES_LOCAL_BRANCH_ID;
  const branchName = MILLIES_LOCAL_BRANCH_NAME;

  await setAuthMeta(MILLIES_AUTH_META.storeName, name);
  await setAuthMeta(MILLIES_AUTH_META.storePhone, input.phone?.trim() ?? "");
  await setAuthMeta(MILLIES_AUTH_META.storeAddress, input.address?.trim() ?? "");
  await setAuthMeta(MILLIES_AUTH_META.organizationId, organizationId);
  await setAuthMeta(MILLIES_AUTH_META.branchId, branchId);
  await setAuthMeta(MILLIES_AUTH_META.branchName, branchName);
  await setAuthMeta(MILLIES_AUTH_META.createdAt, String(Date.now()));

  const session = await createLocalUser({
    username: input.adminUsername,
    displayName: input.adminDisplayName,
    password: input.adminPassword,
    role: "administrator",
  });

  const recoveryKey = generateRecoveryKey();
  await sealRecoveryKey(organizationId, recoveryKey);
  await setAuthMeta(MILLIES_AUTH_META.recoveryKeySealed, "1");
  await setAuthMeta(MILLIES_AUTH_META.setupComplete, "1");

  await bootstrapMilliesStore({
    organizationId,
    branchId,
    branchName,
    storeName: name,
    storePhone: input.phone?.trim() ?? "",
    storeAddress: input.address?.trim() ?? "",
    session,
  });

  // Start the offline trial immediately so the till opens after setup.
  // Admins can still activate a key anytime from Settings → License.
  const { startLicenseTrial } = await import("@/lib/millies-license");
  await startLicenseTrial();

  writeMilliesSession(session);

  return {
    session,
    recoveryKeyDisplay: formatRecoveryKeyForDisplay(recoveryKey),
  };
}

export { isMilliesSetupComplete };
