import type { NotificationPermissionState } from "./native-types";

export function mapNotificationDisplayState(
  display: string | undefined,
  requested: boolean,
): NotificationPermissionState {
  if (display === "granted") return "granted";
  if (display === "denied") return "denied";
  if (display === "prompt-with-rationale") return "prompt";
  if (display === "prompt") return requested ? "prompt" : "not-requested";
  return "error";
}

export function resolveNotificationPermissionState(
  display: string | undefined,
  requested: boolean,
  nativeState: NotificationPermissionState | null,
): NotificationPermissionState {
  const pluginState = mapNotificationDisplayState(display, requested);
  if (nativeState === "not-requested" && requested) return pluginState;
  return nativeState ?? pluginState;
}
