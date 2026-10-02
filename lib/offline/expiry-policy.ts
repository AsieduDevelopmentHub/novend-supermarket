import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";
import {
  DEFAULT_EXPIRY_POLICY,
  parseExpiryPolicy,
  type ExpiryPolicy,
} from "@/convex/shared/expiryPolicy";

export async function saveExpiryPolicyCache(policy: ExpiryPolicy): Promise<void> {
  const db = await getOfflineDb();
  if (!db) return;
  await setMeta(db, META_KEYS.expiryPolicy, JSON.stringify(policy));
}

export async function loadExpiryPolicyCache(): Promise<ExpiryPolicy> {
  const db = await getOfflineDb();
  if (!db) return { ...DEFAULT_EXPIRY_POLICY };
  const raw = await getMeta(db, META_KEYS.expiryPolicy);
  return parseExpiryPolicy(raw ?? undefined);
}
