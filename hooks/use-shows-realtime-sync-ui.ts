"use client";

import { resolveCloudPolicy } from "@/convex/shared/cloudMode";
import { useLicense } from "@/hooks/use-license";

/**
 * Whether the shell should show realtime sync chrome (chip, banner, Sync Center entry).
 * Off for `local_only` and `backup_only` — those modes never drain the live outbox.
 */
export function useShowsRealtimeSyncUi(): boolean {
  const { cloudMode } = useLicense();
  return resolveCloudPolicy(cloudMode).shouldQueueRealtimeSync();
}
