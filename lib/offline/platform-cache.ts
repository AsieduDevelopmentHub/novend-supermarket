/**
 * Super Admin (platform) offline replica helpers.
 * Uses the shared Dexie `meta` store under a platform-scoped DB binding.
 */

import { bindOfflineOrganization, getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";

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
  importJobCount?: number;
  failedImportJobs?: number;
  exportEventCount?: number;
  exportsByFormat?: {
    csv: number;
    xlsx: number;
    pdf: number;
    json: number;
    other: number;
  };
  csvOnlyOrganizations?: number;
  orgsNearImportCap?: Array<{
    id: string;
    name: string;
    productsUsed: number;
    productLimit: number;
    maxImportRows: number;
    percent: number;
    productLimitOverridden: boolean;
  }>;
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
  productsUsed?: number;
  productLimit?: number | null;
  maxImportRows?: number;
  canExportXlsx?: boolean;
  canExportPdf?: boolean;
  importJobCount?: number;
  failedImportCount?: number;
  exportEventCount?: number;
  productLimitOverridden?: boolean;
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

export async function savePlatformOverview(overview: Omit<PlatformOverviewCache, "cachedAt">) {
  await writeJsonMeta(META_KEYS.platformOverview, {
    ...overview,
    cachedAt: Date.now(),
  } satisfies PlatformOverviewCache);
}

export async function loadPlatformOverview(): Promise<PlatformOverviewCache | null> {
  return readJsonMeta<PlatformOverviewCache>(META_KEYS.platformOverview);
}

export async function savePlatformOrganizations(organizations: PlatformOrganizationListItem[]) {
  await writeJsonMeta(META_KEYS.platformOrganizations, {
    organizations,
    cachedAt: Date.now(),
  } satisfies PlatformOrganizationsCache);
}

export async function loadPlatformOrganizations(): Promise<PlatformOrganizationsCache | null> {
  return readJsonMeta<PlatformOrganizationsCache>(META_KEYS.platformOrganizations);
}

export async function savePlatformReleases(channel: string, releases: PlatformReleaseCacheItem[]) {
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
  return readJsonMeta<PlatformOrgDetailCache>(`${META_KEYS.platformOrgDetail}:${organizationId}`);
}

export type PlatformRevenueRange = "today" | "7d" | "30d" | "12m";

export type PlatformRevenueCache = {
  range: PlatformRevenueRange;
  payload: unknown;
  cachedAt: number;
};

export type PlatformSubscriptionsCache = {
  rows: unknown[];
  cachedAt: number;
};

export type PlatformOperatingCostRow = {
  id: string;
  amount: number;
  currency: string;
  category: string;
  occurredAt: number;
  description: string | null;
  createdAt: number;
  /** Local-only draft waiting to sync. */
  pending?: boolean;
};

export type PlatformOperatingCostsCache = {
  rows: PlatformOperatingCostRow[];
  cachedAt: number;
};

export type PlatformHealthCache = {
  payload: unknown;
  cachedAt: number;
};

export type PlatformPaymentCache = {
  paymentId: string;
  payload: unknown;
  cachedAt: number;
};

export type PlatformReleaseBundleCache = {
  version: string;
  payload: unknown;
  cachedAt: number;
};

export type PlatformCostDraftCreate = {
  id: string;
  op: "create";
  amount: number;
  category: string;
  occurredAt: number;
  description?: string;
  currency?: string;
  createdAt: number;
};

export type PlatformCostDraftRemove = {
  id: string;
  op: "remove";
  costId: string;
  createdAt: number;
};

export type PlatformCostDraft = PlatformCostDraftCreate | PlatformCostDraftRemove;

export async function savePlatformRevenue(range: PlatformRevenueRange, payload: unknown) {
  await writeJsonMeta(`${META_KEYS.platformRevenue}:${range}`, {
    range,
    payload,
    cachedAt: Date.now(),
  } satisfies PlatformRevenueCache);
}

export async function loadPlatformRevenue(
  range: PlatformRevenueRange,
): Promise<PlatformRevenueCache | null> {
  return readJsonMeta<PlatformRevenueCache>(`${META_KEYS.platformRevenue}:${range}`);
}

export async function savePlatformSubscriptions(rows: unknown[]) {
  await writeJsonMeta(META_KEYS.platformSubscriptions, {
    rows,
    cachedAt: Date.now(),
  } satisfies PlatformSubscriptionsCache);
}

export async function loadPlatformSubscriptions(): Promise<PlatformSubscriptionsCache | null> {
  return readJsonMeta<PlatformSubscriptionsCache>(META_KEYS.platformSubscriptions);
}

export async function savePlatformOperatingCosts(rows: PlatformOperatingCostRow[]) {
  await writeJsonMeta(META_KEYS.platformOperatingCosts, {
    rows,
    cachedAt: Date.now(),
  } satisfies PlatformOperatingCostsCache);
}

export async function loadPlatformOperatingCosts(): Promise<PlatformOperatingCostsCache | null> {
  return readJsonMeta<PlatformOperatingCostsCache>(META_KEYS.platformOperatingCosts);
}

export async function savePlatformHealth(payload: unknown) {
  await writeJsonMeta(META_KEYS.platformHealth, {
    payload,
    cachedAt: Date.now(),
  } satisfies PlatformHealthCache);
}

export async function loadPlatformHealth(): Promise<PlatformHealthCache | null> {
  return readJsonMeta<PlatformHealthCache>(META_KEYS.platformHealth);
}

export async function savePlatformPayment(paymentId: string, payload: unknown) {
  await writeJsonMeta(`${META_KEYS.platformPaymentDetail}:${paymentId}`, {
    paymentId,
    payload,
    cachedAt: Date.now(),
  } satisfies PlatformPaymentCache);
}

export async function loadPlatformPayment(paymentId: string): Promise<PlatformPaymentCache | null> {
  return readJsonMeta<PlatformPaymentCache>(`${META_KEYS.platformPaymentDetail}:${paymentId}`);
}

export async function savePlatformReleaseBundle(version: string, payload: unknown) {
  await writeJsonMeta(`${META_KEYS.platformReleaseDetail}:${version}`, {
    version,
    payload,
    cachedAt: Date.now(),
  } satisfies PlatformReleaseBundleCache);
}

export async function loadPlatformReleaseBundle(
  version: string,
): Promise<PlatformReleaseBundleCache | null> {
  return readJsonMeta<PlatformReleaseBundleCache>(`${META_KEYS.platformReleaseDetail}:${version}`);
}

export async function loadPlatformCostDraftQueue(): Promise<PlatformCostDraft[]> {
  const row = await readJsonMeta<{ drafts: PlatformCostDraft[] }>(META_KEYS.platformCostDraftQueue);
  return row?.drafts ?? [];
}

export async function savePlatformCostDraftQueue(drafts: PlatformCostDraft[]) {
  await writeJsonMeta(META_KEYS.platformCostDraftQueue, { drafts });
}

export async function enqueuePlatformCostDraft(draft: PlatformCostDraft) {
  const drafts = await loadPlatformCostDraftQueue();
  drafts.push(draft);
  await savePlatformCostDraftQueue(drafts);
  return drafts;
}

export async function dequeuePlatformCostDraft(draftId: string) {
  const drafts = await loadPlatformCostDraftQueue();
  const next = drafts.filter((row) => row.id !== draftId);
  await savePlatformCostDraftQueue(next);
  return next;
}

export type PlatformInsightCache = {
  metric: string;
  range: string;
  payload: unknown;
  cachedAt: number;
};

export async function savePlatformInsight(metric: string, range: string, payload: unknown) {
  await writeJsonMeta(`${META_KEYS.platformInsight}:${metric}:${range}`, {
    metric,
    range,
    payload,
    cachedAt: Date.now(),
  } satisfies PlatformInsightCache);
}

export async function savePlatformReleaseBundles(channel: string, payload: unknown) {
  await writeJsonMeta(`${META_KEYS.platformReleaseBundles}:${channel}`, {
    channel,
    payload,
    cachedAt: Date.now(),
  });
}

export async function loadPlatformReleaseBundles(
  channel: string,
): Promise<{ channel: string; payload: unknown; cachedAt: number } | null> {
  return readJsonMeta(`${META_KEYS.platformReleaseBundles}:${channel}`);
}

export async function loadPlatformInsight(
  metric: string,
  range: string,
): Promise<PlatformInsightCache | null> {
  return readJsonMeta<PlatformInsightCache>(`${META_KEYS.platformInsight}:${metric}:${range}`);
}
