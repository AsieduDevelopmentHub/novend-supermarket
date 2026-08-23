/**
 * Super Admin (platform) offline replica helpers.
 * Uses the shared Dexie `meta` store under a platform-scoped DB binding.
 */

import {
  bindOfflineOrganization,
  getMeta,
  getOfflineDb,
  META_KEYS,
  setMeta,
} from "./db";

export const PLATFORM_OFFLINE_ORG_ID = "platform";

const PLATFORM_SESSION_KEY = "novend.platformOfflineSession";

export type PlatformOfflineSession = {
  userId: string;
  name: string;
  email: string | null;
  hasTenantRole: boolean;
  savedAt: number;
};

export type PlatformOverviewCache = {
  organizationCount: number;
  activeOrganizations: number;
  trialOrganizations: number;
  suspendedOrganizations: number;
  expiredOrganizations: number;
  inactiveOrganizations: number;
  userCount: number;
  branchCount: number;
  saleCount: number;
  salesLast24h: number;
  recentOrganizations: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    plan: string;
    createdAt: number;
  }>;
  cachedAt: number;
};

export type PlatformOrganizationListItem = {
  id: string;
  name: string;
  slug: string;
  status: string;
  planKey: string;
  plan: string;
  currency: string;
  createdAt: number;
  trialEndsAt: number | null;
  userCount: number;
  saleCount: number;
};

export type PlatformOrganizationsCache = {
  organizations: PlatformOrganizationListItem[];
  cachedAt: number;
};

export type PlatformReleaseAssetCache = {
  githubAssetId: number;
  fileName: string;
  platform: string;
  arch: string;
  size?: number;
  downloadUrl?: string | null;
};

export type PlatformReleaseCacheItem = {
  _id: string;
  version: string;
  tag: string;
  channel: string;
  notes: string;
  releasedAt: number;
  mandatory: boolean;
  assets: PlatformReleaseAssetCache[];
};

export type PlatformReleasesCache = {
  channel: string;
  releases: PlatformReleaseCacheItem[];
  cachedAt: number;
};

export type PlatformOrgDetailCache = {
  organizationId: string;
  payload: unknown;
  cachedAt: number;
};

/** Bind Dexie to the platform replica for this Super Admin user. */
export function bindPlatformOfflineDb(userId: string) {
  bindOfflineOrganization(PLATFORM_OFFLINE_ORG_ID, userId);
}

export function markPlatformOfflineSession(session: PlatformOfflineSession) {
  try {
    window.localStorage.setItem(PLATFORM_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* private mode / quota */
  }
  bindPlatformOfflineDb(session.userId);
}

export function clearPlatformOfflineSession() {
  try {
    window.localStorage.removeItem(PLATFORM_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function readPlatformOfflineSession(): PlatformOfflineSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PLATFORM_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlatformOfflineSession;
    if (!parsed?.userId || !parsed?.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readJsonMeta<T>(key: string): Promise<T | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const raw = await getMeta(db, key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonMeta(key: string, value: unknown) {
  const db = await getOfflineDb();
  if (!db) return;
  await setMeta(db, key, JSON.stringify(value));
}

export async function savePlatformOverview(
  overview: Omit<PlatformOverviewCache, "cachedAt">,
) {
  await writeJsonMeta(META_KEYS.platformOverview, {
    ...overview,
    cachedAt: Date.now(),
  } satisfies PlatformOverviewCache);
}

export async function loadPlatformOverview(): Promise<PlatformOverviewCache | null> {
  return readJsonMeta<PlatformOverviewCache>(META_KEYS.platformOverview);
}

export async function savePlatformOrganizations(
  organizations: PlatformOrganizationListItem[],
) {
  await writeJsonMeta(META_KEYS.platformOrganizations, {
    organizations,
    cachedAt: Date.now(),
  } satisfies PlatformOrganizationsCache);
}

export async function loadPlatformOrganizations(): Promise<PlatformOrganizationsCache | null> {
  return readJsonMeta<PlatformOrganizationsCache>(META_KEYS.platformOrganizations);
}

export async function savePlatformReleases(
  channel: string,
  releases: PlatformReleaseCacheItem[],
) {
  await writeJsonMeta(META_KEYS.platformReleases, {
    channel,
    releases,
    cachedAt: Date.now(),
  } satisfies PlatformReleasesCache);
}

export async function loadPlatformReleases(): Promise<PlatformReleasesCache | null> {
  return readJsonMeta<PlatformReleasesCache>(META_KEYS.platformReleases);
}

export async function savePlatformOrgDetail(organizationId: string, payload: unknown) {
  await writeJsonMeta(`${META_KEYS.platformOrgDetail}:${organizationId}`, {
    organizationId,
    payload,
    cachedAt: Date.now(),
  } satisfies PlatformOrgDetailCache);
}

export async function loadPlatformOrgDetail(
  organizationId: string,
): Promise<PlatformOrgDetailCache | null> {
  return readJsonMeta<PlatformOrgDetailCache>(
    `${META_KEYS.platformOrgDetail}:${organizationId}`,
  );
}
