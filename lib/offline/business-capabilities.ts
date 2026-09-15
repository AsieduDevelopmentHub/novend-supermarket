import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";
import {
  DEFAULT_BUSINESS_CONFIGURATION,
  parseBusinessConfiguration,
  type OrganizationBusinessConfiguration,
} from "@/convex/shared/businessCapabilities";

export async function saveBusinessCapabilitiesCache(
  config: OrganizationBusinessConfiguration,
): Promise<void> {
  const db = await getOfflineDb();
  if (!db) return;
  await setMeta(db, META_KEYS.businessCapabilities, JSON.stringify(config));
}

export async function loadBusinessCapabilitiesCache(): Promise<OrganizationBusinessConfiguration> {
  const db = await getOfflineDb();
  if (!db) return { ...DEFAULT_BUSINESS_CONFIGURATION };
  const raw = await getMeta(db, META_KEYS.businessCapabilities);
  return parseBusinessConfiguration(raw);
}
