import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";
import {
  DEFAULT_BUSINESS_CONFIGURATION,
  parseBusinessConfiguration,
  type BusinessCapabilityKey,
  type OrganizationBusinessConfiguration,
} from "@/convex/shared/businessCapabilities";

/** Previous Millies supermarket preset (multi-pack was on by default). */
const LEGACY_SUPERMARKET_DEFAULT: readonly BusinessCapabilityKey[] = [
  "multi_unit_pricing",
  "lot_expiry",
  "sell_by_weight",
  "configurable_pos",
];

function sameCapabilitySet(
  left: readonly BusinessCapabilityKey[],
  right: readonly BusinessCapabilityKey[],
): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((key) => rightSet.has(key));
}

/**
 * Millies supermarket pack no longer enables multi-pack by default.
 * Only rewrite exact legacy presets — custom capability mixes stay untouched.
 */
function migrateLegacySupermarketDefault(
  config: OrganizationBusinessConfiguration,
): OrganizationBusinessConfiguration {
  if (config.industryProfile !== "supermarket") return config;
  if (!sameCapabilitySet(config.enabledCapabilities, LEGACY_SUPERMARKET_DEFAULT)) {
    return config;
  }
  return {
    ...config,
    enabledCapabilities: [...DEFAULT_BUSINESS_CONFIGURATION.enabledCapabilities],
    configurationVersion: DEFAULT_BUSINESS_CONFIGURATION.configurationVersion,
  };
}

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
  const parsed = parseBusinessConfiguration(raw);
  const migrated = migrateLegacySupermarketDefault(parsed);
  if (migrated !== parsed) {
    await setMeta(db, META_KEYS.businessCapabilities, JSON.stringify(migrated));
  }
  return migrated;
}
