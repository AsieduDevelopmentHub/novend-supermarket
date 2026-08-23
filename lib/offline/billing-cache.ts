/**
 * Cached billing dashboard + payment history for offline Settings → Billing.
 * Convex remains authoritative; this is the last confirmed snapshot.
 */
import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";

export type CachedBillingOverview = {
  organizationId: string;
  organizationName: string;
  organizationStatus: string;
  currency: string;
  planKey: string;
  plan: {
    key: string;
    name: string;
    tagline: string;
    isLifetime: boolean;
    features: string[];
  };
  access: {
    state: string;
    canRead: boolean;
    canWrite: boolean;
    reason: string | null;
    expiresAt: number | null;
  };
  trialEndsAt: number | null;
  subscription: {
    id: string;
    status: string;
    billingCycle: string;
    isLifetime: boolean;
    startsAt: number;
    expiresAt: number | null;
    nextBillingDate: number | null;
    amount: number;
    currency: string;
    paymentGateway: string;
    cancelAtPeriodEnd: boolean;
    scheduledChange?: {
      type: "downgrade";
      targetPlanKey: string;
      targetCycle: string;
      effectiveAt: number;
      createdAt: number;
      status: "scheduled";
    } | null;
  } | null;
  usage: Array<{
    resource: string;
    used: number;
    limit: number | null;
    remaining: number | null;
    percent: number;
    level: string;
    unlimited: boolean;
  }>;
  onlinePaymentsEnabled: boolean;
  cachedAt: number;
};

export type CachedBillingHistoryRow = {
  id: string;
  amount: number;
  currency: string;
  gateway: string;
  reference: string;
  status: string;
  description: string;
  kind?: string | null;
  planKey: string | null;
  billingCycle: string | null;
  paidAt: number | null;
  createdAt: number;
};

async function readJson<T>(key: string): Promise<T | null> {
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

async function writeJson(key: string, value: unknown) {
  const db = await getOfflineDb();
  if (!db) return;
  await setMeta(db, key, JSON.stringify(value));
}

export async function saveBillingOverview(payload: Omit<CachedBillingOverview, "cachedAt">) {
  await writeJson(META_KEYS.billingOverview, { ...payload, cachedAt: Date.now() });
}

export async function loadBillingOverview(): Promise<CachedBillingOverview | null> {
  return readJson<CachedBillingOverview>(META_KEYS.billingOverview);
}

export async function saveBillingHistory(rows: CachedBillingHistoryRow[]) {
  await writeJson(META_KEYS.billingHistory, { rows, cachedAt: Date.now() });
}

export async function loadBillingHistory(): Promise<CachedBillingHistoryRow[] | null> {
  const row = await readJson<{ rows: CachedBillingHistoryRow[] }>(META_KEYS.billingHistory);
  return row?.rows ?? null;
}
