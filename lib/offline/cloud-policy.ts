/**
 * Client-side resolver for the tenant cloud usage mode.
 *
 * Reads the last confirmed licence snapshot from the offline cache and turns it
 * into a `CloudPolicy`. Callers use the policy to decide whether background
 * sync, outbox flush, or realtime mirroring should run for this organization.
 */
import {
  DEFAULT_CLOUD_MODE,
  normalizeCloudMode,
  resolveCloudPolicy,
  type CloudPolicy,
} from "@/convex/shared/cloudMode";
import { loadLicenseSnapshot } from "./license";

export async function loadCloudPolicy(): Promise<CloudPolicy> {
  const license = await loadLicenseSnapshot();
  const mode =
    license?.cloudMode != null ? normalizeCloudMode(license.cloudMode) : DEFAULT_CLOUD_MODE;
  return resolveCloudPolicy(mode);
}
