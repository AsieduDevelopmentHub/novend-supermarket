import type { UpdateInfo } from "@novend/hardware";

/**
 * User-facing update-check copy. Offline is never an alarm.
 * Unknown/unreachable is a quiet status, not a boot blocker.
 */
export function describeUpdateCheck(input: {
  checking: boolean;
  online: boolean;
  update: UpdateInfo | null;
}): string {
  if (input.checking) return "Checking…";
  if (input.update?.status === "available") {
    return `v${input.update.version ?? "new release"} available`;
  }
  if (input.update?.status === "latest") return "Latest verified";
  if (!input.online || input.update?.status === "offline") {
    return "Offline — check when connected";
  }
  if (input.update?.status === "unconfigured") {
    return "Update checks are not configured for this build";
  }
  if (input.update?.status === "unreachable") {
    return "Could not reach the update server";
  }
  return "Unable to verify right now";
}
