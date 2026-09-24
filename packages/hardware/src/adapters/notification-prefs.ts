import { readLocalPref, removeLocalPref, writeLocalPref } from "./local-prefs";
import type { NotificationTopic } from "../native-types";

const TOPIC_KEY = "novend.notifications.topics";
const ENDPOINT_KEY = "novend.notifications.endpoint";

export const DEFAULT_NOTIFICATION_TOPICS: Record<NotificationTopic, boolean> = {
  stock_alerts: true,
  daily_summary: false,
  branch_transfers: true,
  subscription_alerts: true,
};

export function readTopicPrefsFromStorage(): Record<NotificationTopic, boolean> {
  const raw = readLocalPref(TOPIC_KEY);
  if (!raw) return { ...DEFAULT_NOTIFICATION_TOPICS };
  try {
    return {
      ...DEFAULT_NOTIFICATION_TOPICS,
      ...(JSON.parse(raw) as Record<NotificationTopic, boolean>),
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_TOPICS };
  }
}

export function writeTopicPrefsToStorage(
  prefs: Partial<Record<NotificationTopic, boolean>>,
): Record<NotificationTopic, boolean> {
  const next = { ...readTopicPrefsFromStorage(), ...prefs };
  writeLocalPref(TOPIC_KEY, JSON.stringify(next));
  return next;
}

export function readStoredPushEndpoint(): string | null {
  return readLocalPref(ENDPOINT_KEY);
}

export function writeStoredPushEndpoint(endpoint: string): void {
  writeLocalPref(ENDPOINT_KEY, endpoint);
}

export function clearStoredPushEndpoint(): void {
  removeLocalPref(ENDPOINT_KEY);
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
