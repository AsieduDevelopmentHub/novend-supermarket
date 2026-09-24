/** Shared notification topic keys for Convex + hardware clients. */
export const NOTIFICATION_TOPICS = [
  "stock_alerts",
  "daily_summary",
  "branch_transfers",
  "subscription_alerts",
] as const;

export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number];

export type NotificationTopicPrefs = Record<NotificationTopic, boolean>;

export const DEFAULT_NOTIFICATION_TOPICS: NotificationTopicPrefs = {
  stock_alerts: true,
  daily_summary: false,
  branch_transfers: true,
  subscription_alerts: true,
};

export function mergeTopicPrefs(
  partial?: Partial<NotificationTopicPrefs> | null,
): NotificationTopicPrefs {
  return { ...DEFAULT_NOTIFICATION_TOPICS, ...(partial ?? {}) };
}
