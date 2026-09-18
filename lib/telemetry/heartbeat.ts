/**
 * Platform telemetry heartbeat client.
 *
 * Sends a tiny, rate-limited platform heartbeat so Novend can license, manage,
 * and monitor organizations — including `local_only` tenants that never sync
 * business data. This is deliberately independent of the business sync engine
 * and the product-event pipeline: it runs even when the cloud policy disables
 * realtime sync and backups.
 *
 * The client contributes only app version, a storage estimate, the last backup
 * time, and outbox counts. Authoritative fields (cloud mode, plan, entitlement
 * version, resource counts) are derived server-side. To keep Convex usage
 * minimal we pre-filter here: send immediately when a client-visible signature
 * (app version, cloud mode, entitlement version) changes, otherwise at most once
 * per 24h. The server performs the final authoritative dedup.
 *
 * See docs/architecture/CLOUD_MODE_PLAN_V2.md (§3–§9, §42).
 */

import { APP_VERSION } from "@/constants/app";
import { getMeta, getOfflineDb, META_KEYS, setMeta } from "@/lib/offline/db";
import { loadLicenseSnapshot } from "@/lib/offline/license";
import { getLastBackupAt } from "@/lib/offline/backup";
import { countOutboxByStatus } from "@/lib/offline/outbox";

const HEARTBEAT_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type HeartbeatArgs = {
  appVersion?: string;
  localStorageBytes?: number;
  lastBackupAt?: number;
  pendingSyncCount?: number;
  failedSyncCount?: number;
};

type HeartbeatState = { signature: string; sentAt: number };

/** Client-visible fields whose change should send a heartbeat without waiting 24h. */
function buildSignature(appVersion: string, cloudMode: string, entitlementVersion: number): string {
  return `${appVersion}|${cloudMode}|${entitlementVersion}`;
}

async function readState(): Promise<HeartbeatState | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const raw = await getMeta(db, META_KEYS.telemetryHeartbeat);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HeartbeatState;
    if (typeof parsed.signature === "string" && typeof parsed.sentAt === "number") return parsed;
  } catch {
    /* fall through */
  }
  return null;
}

async function writeState(state: HeartbeatState): Promise<void> {
  const db = await getOfflineDb();
  if (!db) return;
  await setMeta(db, META_KEYS.telemetryHeartbeat, JSON.stringify(state));
}

async function estimateLocalStorageBytes(): Promise<number | undefined> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      if (typeof estimate.usage === "number") return estimate.usage;
    }
  } catch {
    /* best-effort */
  }
  return undefined;
}

/**
 * Sends a heartbeat when due. Safe to call on mount, focus, and reconnect —
 * it self-throttles and never throws into the caller. Returns whether a network
 * call was attempted.
 */
export async function maybeSendHeartbeat(
  sendHeartbeat: (args: HeartbeatArgs) => Promise<unknown>,
): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) return false;

    const license = await loadLicenseSnapshot();
    // No confirmed licence yet (fresh device / signed out): nothing to report.
    if (!license) return false;

    const appVersion = APP_VERSION;
    const cloudMode = license.cloudMode ?? "full_sync";
    const entitlementVersion = license.entitlementVersion ?? 0;
    const signature = buildSignature(appVersion, String(cloudMode), entitlementVersion);

    const state = await readState();
    const now = Date.now();
    const dueByTime = !state || now - state.sentAt >= HEARTBEAT_MIN_INTERVAL_MS;
    const dueByChange = !state || state.signature !== signature;
    if (!dueByTime && !dueByChange) return false;

    const [counts, lastBackupAt, localStorageBytes] = await Promise.all([
      countOutboxByStatus(),
      getLastBackupAt(),
      estimateLocalStorageBytes(),
    ]);

    await sendHeartbeat({
      appVersion,
      localStorageBytes,
      lastBackupAt: lastBackupAt ?? undefined,
      pendingSyncCount: counts.pending + counts.syncing,
      failedSyncCount: counts.failed,
    });

    await writeState({ signature, sentAt: now });
    return true;
  } catch {
    // Telemetry must never interfere with POS workflows.
    return false;
  }
}
