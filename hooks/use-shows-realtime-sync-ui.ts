"use client";

import { FULLY_OFFLINE } from "@/constants/runtime";
import { resolveCloudPolicy } from "@/convex/shared/cloudMode";
import { useLicense } from "@/hooks/use-license";

/**
 * Whether the shell should show realtime sync chrome (chip, banner, Sync Center entry).
 * Off for `local_only` and `backup_only` — those modes never drain the live outbox.
 * Always off for Millie's fully offline till.
 */
export function useShowsRealtimeSyncUi(): boolean {
  const { cloudMode } = useLicense();
  if (FULLY_OFFLINE) return false;
  return resolveCloudPolicy(cloudMode).shouldQueueRealtimeSync();
}
